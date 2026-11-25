const json = (value, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
const digest = value => crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const journeys = {estancias:'Estancias & Glaciers',unhurried:'Torres del Paine, Unhurried',private:'Private Patagonia'};
const replyError = (code, status) => json({error:code},status);
const dayMs = 86400000;
const retentionDays = 90;
const testSource = source => /^utm:(usability_test|user_test)(?:\/|$)/i.test(source);
const isSessionKey = key => typeof key === 'string' && uuid.test(key);
const validOrigin = request => !request.headers.get('Origin') || request.headers.get('Origin') === new URL(request.url).origin;

// Only fixed channel names reach the metrics table. Campaign text and referrers can contain personal details.
function funnelSource(source) {
  if (['direct/unknown','instagram','search','referral','website'].includes(source)) return source;
  if (!source.startsWith('utm:')) return 'direct/unknown';
  const [name,medium] = source.slice(4).split('/');
  if (['instagram','ig','l.instagram.com'].includes(name)) return 'instagram';
  if (['google','bing','duckduckgo'].includes(name)) return 'search';
  if (['email','newsletter'].includes(name) || medium === 'email') return 'email';
  if (name === 'itinerary_pdf') return 'itinerary_pdf';
  if (name === 'facebook' || name === 'fb') return 'facebook';
  return 'other_campaign';
}
const pruneSessions = (db, now) => db.prepare('DELETE FROM trip_sessions WHERE first_visit_at < ?').bind(now - retentionDays * dayMs);

async function rateLimited(request,env,now,kind) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  const hour = Math.floor(now / 3600000);
  const parts = [env.INTAKE_TOKEN,hour,ip];
  if (kind === 'visit') parts.unshift('visit');
  const key = hex(await digest(JSON.stringify(parts)));
  const [, bucket] = await env.DB.batch([
    env.DB.prepare('DELETE FROM submission_windows WHERE expires < ?').bind(Math.floor(now / 1000)),
    env.DB.prepare('INSERT INTO submission_windows(key,expires,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(hour+1)*3600)
  ]);
  return bucket.results[0].count > (kind === 'visit' ? 240 : 20);
}
async function visit(request,env) {
  if (!validOrigin(request)) return replyError('origin',403);
  const data = await input(request);
  if (!isSessionKey(data?.session_key) || typeof data.source !== 'string' || data.source.length > 160) return replyError('invalid_visit',400);
  const test = testSource(data.source) || (request.headers.get('X-Enquiry-Test') === '1' && await authorized(request,env));
  if (!test) {
    const now = Date.now();
    const session = data.session_key.toLowerCase();
    const existing = await env.DB.prepare('SELECT 1 FROM trip_sessions WHERE session_key=? AND first_visit_at>=?').bind(session,now-retentionDays*dayMs).first();
    if (existing) return json({ok:true});
    if (await rateLimited(request,env,now,'visit')) return replyError('rate_limit',429);
    await env.DB.batch([
      pruneSessions(env.DB,now),
      env.DB.prepare('INSERT INTO trip_sessions(session_key,source,first_visit_at) VALUES (?,?,?) ON CONFLICT(session_key) DO NOTHING')
        .bind(session,funnelSource(data.source),now)
    ]);
  }
  return json({ok:true});
}
async function funnelReport(url,db) {
  const raw = url.searchParams.get('days') ?? '30';
  if (!/^[1-9][0-9]?$/.test(raw) || Number(raw) > retentionDays) return replyError('invalid_days',400);
  const days = Number(raw);
  const through = Date.now();
  const from = through - days * dayMs;
  const [, result] = await db.batch([
    pruneSessions(db,through),
    db.prepare('SELECT source,COUNT(*) AS sessions,COUNT(first_enquiry_at) AS enquiring_sessions FROM trip_sessions WHERE first_visit_at BETWEEN ? AND ? GROUP BY source ORDER BY sessions DESC,source').bind(from,through)
  ]);
  const rate = row => ({...row,conversion_rate:row.sessions ? row.enquiring_sessions / row.sessions : null});
  const totals = {sessions:0,enquiring_sessions:0};
  for (const row of result.results) {
    totals.sessions += row.sessions;
    totals.enquiring_sessions += row.enquiring_sessions;
  }
  return json({days,from:new Date(from).toISOString(),through:new Date(through).toISOString(),totals:rate(totals),by_source:result.results.map(rate)});
}

async function authorized(request, env) {
  if (!env.INTAKE_TOKEN) return false;
  const supplied = request.headers.get('Authorization') || '';
  const [left,right] = await Promise.all([digest(supplied),digest('Bearer ' + env.INTAKE_TOKEN)]);
  const b = new Uint8Array(right);
  return new Uint8Array(left).reduce((delta,n,i) => delta | (n ^ b[i]),0) === 0;
}
async function input(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return;
  const reader = request.body?.getReader();
  if (!reader) return;
  let length = 0;
  const chunks = [];
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16000) { await reader.cancel(); return; }
    chunks.push(value);
  }
  try { const v = await new Response(new Blob(chunks)).json(); return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined; } catch {}
}
async function receive(request,env) {
  if (!validOrigin(request)) return replyError('origin',403);
  const raw = await input(request);
  if (!raw || raw.website || typeof raw.request_key !== 'string' || !uuid.test(raw.request_key) || typeof raw.journey !== 'string' || !Object.hasOwn(journeys,raw.journey)) return replyError('invalid_form',400);
  const fields = {};
  for (const [key,max] of Object.entries({email:200,name:90,month:32,travelers:32,question:2000,source:160})) {
    const value = raw[key] ?? '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return replyError('invalid_field',400);
    fields[key] = value.trim();
  }
  if (!fields.name || !fields.question || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return replyError('invalid_form',400);
  if (!/^(direct\/unknown|instagram|search|referral|website|utm:[a-z0-9_.-]{1,48}(\/[a-z0-9_.-]{1,48})?)$/.test(fields.source)) fields.source='direct/unknown';
  const isTest = request.headers.get('X-Enquiry-Test') === '1' && await authorized(request,env) ? 1 : 0;
  const fingerprint = hex(await digest(JSON.stringify([fields,raw.journey,isTest])));
  const query = env.DB.prepare('SELECT id,fingerprint FROM enquiries WHERE request_key=?').bind(raw.request_key);
  const receipt = found => found?.fingerprint === fingerprint ? json({id:found.id},200) : replyError('key_conflict',409);
  const existing = await query.first();
  if (existing) return receipt(existing);
  const now = new Date();
  if (!isTest && await rateLimited(request,env,now.getTime(),'enquiry')) return replyError('rate_limit',429);
  const id = 'PA-' + crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
  const store = env.DB.prepare('INSERT INTO enquiries(id,request_key,fingerprint,email,name,journey,month,travelers,question,source,received_at,is_test) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING')
    .bind(id,raw.request_key,fingerprint,fields.email,fields.name,journeys[raw.journey],fields.month,fields.travelers,fields.question,fields.source,now.toISOString(),isTest);
  let insert;
  if (isSessionKey(raw.session_key) && (isTest || !testSource(fields.source))) {
    const session = raw.session_key.toLowerCase();
    // The newly generated receipt exists only for the winning insert, so a retry cannot convert another session.
    const receiptExists = ' AND EXISTS (SELECT 1 FROM enquiries WHERE id=?)';
    const mark = isTest
      ? env.DB.prepare('DELETE FROM trip_sessions WHERE session_key=?' + receiptExists).bind(session,id)
      : env.DB.prepare('UPDATE trip_sessions SET first_enquiry_at=? WHERE session_key=? AND first_enquiry_at IS NULL AND first_visit_at BETWEEN ? AND ?' + receiptExists)
          .bind(now.getTime(),session,now.getTime()-dayMs,now.getTime(),id);
    try { [insert] = await env.DB.batch([store,mark]); }
    catch { /* Metrics are optional. A missing metrics table must never prevent an enquiry. */ }
  }
  if (!insert) insert = await store.run();
  return insert.meta.changes ? json({id},201) : receipt(await query.first());
}
async function internal(request,env,url) {
  if (!await authorized(request,env)) return replyError('unauthorized',401);
  if (request.method === 'GET' && url.pathname === '/api/internal/funnel') return funnelReport(url,env.DB);
  if (request.method === 'GET' && url.pathname === '/api/internal/enquiries') {
    const limit = Math.min(50,Math.max(1,Number.parseInt(url.searchParams.get('limit') || '25',10) || 25));
    const {results} = await env.DB.prepare('SELECT id,email,name,journey,month,travelers,question,source,received_at,is_test FROM enquiries WHERE acknowledged_at IS NULL ORDER BY received_at,id LIMIT ?').bind(limit).all();
    return json({enquiries:results.map(row => ({...row,is_test:Boolean(row.is_test)}))});
  }
  if (request.method === 'POST' && url.pathname === '/api/internal/enquiries/ack') {
    const data = await input(request);
    if (typeof data?.id !== 'string' || !/^PA-[A-F0-9]{16}$/.test(data.id)) return replyError('invalid_id',400);
    // CRM holds the original after acknowledgment. Keep only the fields needed for a safe retry.
    const result = await env.DB.prepare("UPDATE enquiries SET acknowledged_at=COALESCE(acknowledged_at,?),email='',name='',question='',month='',travelers='' WHERE id=?").bind(new Date().toISOString(),data.id).run();
    return result.meta.changes ? json({ok:true}) : replyError('unknown',404);
  }
  return replyError('not_found',404);
}
const mime = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',jpg:'image/jpeg',pdf:'application/pdf',txt:'text/plain',xml:'application/xml'};
export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/internal/')) return await internal(request,env,url);
      if (url.pathname === '/api/funnel/visit') return request.method === 'POST' ? await visit(request,env) : replyError('method',405);
      if (url.pathname === '/api/enquiries') return request.method === 'POST' ? await receive(request,env) : replyError('method',405);
      if (!['GET','HEAD'].includes(request.method)) return replyError('method',405);
      let key=url.pathname;
      if (!key.endsWith('/') && Object.hasOwn(FILES,key + '/index.html')) {
        url.pathname += '/'; return Response.redirect(url.href,308);
      }
      if (key.endsWith('/')) key += 'index.html';
      if (!Object.hasOwn(FILES,key)) return new Response('Page not found',{status:404});
      const ext = key.split('.').pop();
      const bytes = request.method === 'HEAD' ? null : Uint8Array.from(atob(FILES[key]), c => c.charCodeAt(0));
      return new Response(bytes,{headers:{'Content-Type':mime[ext],'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':ext === 'html' ? 'public, max-age=60' : 'public, max-age=900'}});
    } catch { return replyError('temporarily_unavailable',503); }
  }
};
