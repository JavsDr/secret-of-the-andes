(() => {
  const host = document.getElementById('trip-enquiry');
  if (!host) return;
  host.innerHTML = `
    <form class="trip-form">
      <label>Your name <input name="name" autocomplete="name" maxlength="90" required></label>
      <label>Email address <input name="email" type="email" autocomplete="email" maxlength="200" required></label>
      <label>Journey <select name="journey">
        <option value="estancias">Estancias &amp; Glaciers</option><option value="unhurried">Torres del Paine, Unhurried</option><option value="private">Private Patagonia</option>
      </select></label>
      <div class="trip-pair"><label>Preferred month (optional) <select name="month"><option value="">Still deciding</option></select></label>
      <label>Travellers (optional) <select name="travelers"><option value="">Still deciding</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5–8</option><option>9 or more</option></select></label></div>
      <label>What would you like to know? <textarea name="question" rows="3" maxlength="2000" required placeholder="For example, how much walking is involved on the fjord day?"></textarea></label>
      <div hidden aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>
      <p class="trip-note">Javier and the trip planning team will use these details to answer your enquiry by email. Please leave out passport and medical information.</p>
      <button type="submit" class="button primary">Send my enquiry</button>
    </form><div class="trip-status" role="status" tabindex="-1" aria-live="polite"></div>`;
  const form = host.querySelector('form');
  const status = host.querySelector('[role="status"]');
  const button = form.querySelector('button');
  const field = name => form.elements.namedItem(name);
  for (const month of ['January','February','March','April','May','June','July','August','September','October','November','December']) field('month').add(new Option(month,month));
  const journey = new URLSearchParams(location.search).get('journey');
  if (['unhurried','private','estancias'].includes(journey)) field('journey').value = journey;

  // Count a measured tab once. Storage or measurement failures leave the form available.
  const analyticsStorage = 'andes.trip.visit.v1';
  const dayMs = 86400000;
  const source = window.andesTripSource || 'direct/unknown';
  let session;
  function measureVisit() {
    if (/^utm:(usability_test|user_test)(?:\/|$)/i.test(source)) return;
    try {
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(analyticsStorage)); } catch {}
      const now = Date.now();
      if (typeof saved?.key !== 'string' || !Number.isFinite(saved.started) || saved.started > now || now - saved.started >= dayMs) {
        saved = {key:crypto.randomUUID(),started:now,measured:false};
        sessionStorage.setItem(analyticsStorage,JSON.stringify(saved));
      }
      session = saved;
      if (session.measured) return;
      const current = session;
      fetch('/api/funnel/visit',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',keepalive:true,
        body:JSON.stringify({session_key:current.key,source})})
        .then(response => {
          if (!response.ok || JSON.parse(sessionStorage.getItem(analyticsStorage))?.key !== current.key) return;
          current.measured = true;
          sessionStorage.setItem(analyticsStorage,JSON.stringify(current));
        }).catch(() => {});
    } catch { session = undefined; }
  }
  measureVisit();
  let retryKey, previousBody, sending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    sending = true;
    button.disabled = true;
    status.textContent = 'Sending your enquiry…';
    const body = Object.fromEntries(new FormData(form));
    body.source = source;
    const snapshot = JSON.stringify(body);
    if (session && Date.now() - session.started < dayMs) body.session_key = session.key;
    if (previousBody !== snapshot) retryKey = crypto.randomUUID();
    previousBody = snapshot;
    try {
      const response = await fetch('/api/enquiries', {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit', body:JSON.stringify({...body,request_key:retryKey}),signal:AbortSignal.timeout(22000)});
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json();
      if (!result.id) throw new Error('missing receipt');
      form.hidden = true;
      status.textContent = 'Thank you. We received your enquiry. Your reference is ' + result.id + '. Javier and the trip planning team will reply to the email address you provided.';
    } catch (error) {
      status.textContent = error.message === '429' ? 'Please wait an hour before trying again, or use the email link below.' : 'We could not confirm receipt. Your answers are still here. Try again, or use the email link below.';
    } finally {
      sending = false;
      button.disabled = false;
      status.focus();
    }
  });
})();
