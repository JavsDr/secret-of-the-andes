// Keep the first observed source through navigation. Store no full referrers.
(() => {
  const url = new URL(location.href);
  const key = 'andes.trip.source.v1';
  const clean = value => /^[a-z0-9_.-]{1,48}$/i.test(value || '') ? value.toLowerCase() : '';
  const sources = ['direct/unknown','instagram','search','referral','website'];
  const handed = url.searchParams.get('entry');
  const campaign = clean(url.searchParams.get('utm_source'));
  const medium = clean(url.searchParams.get('utm_medium'));
  let ref = '';
  try { ref = new URL(document.referrer).hostname.toLowerCase(); } catch {}
  const hostIs = host => ref === host || ref.endsWith('.' + host);
  let source;
  if (campaign) source = 'utm:' + campaign + (medium ? '/' + medium : '');
  else if (sources.includes(handed)) source = handed;
  else if (hostIs('instagram.com')) source = 'instagram';
  else if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(ref)) source = 'search';
  else if (ref && ref !== location.hostname && ref !== 'javsdr.github.io') source = 'referral';
  try {
    const saved = sessionStorage.getItem(key);
    source = source || saved || 'direct/unknown';
    sessionStorage.setItem(key, source);
  } catch { source = source || 'direct/unknown'; }
  window.andesTripSource = source;

  // Bookmarks, Instagram and previous PDFs can keep using their original address.
  if (location.hostname === 'javsdr.github.io' && url.pathname.startsWith('/secret-of-the-andes/')) {
    const next = new URL('https://secret-of-the-andes.politebrioche2.chatgpt.site');
    next.pathname = url.pathname.slice('/secret-of-the-andes'.length);
    next.search = url.search;
    if (!campaign && sources.includes(source)) next.searchParams.set('entry',source);
    next.hash = url.hash;
    location.replace(next.href);
  }
})();
