// Car page loader: fetches this car's encrypted data, decrypts it in the browser, then starts the torque module.
// Minified and inlined by the server, which fills in the public car index and half of the key for each page.
(async () => {
  const B = window.BS, box = document.getElementById('bsLoad'), IDX = __INDEX__;
  const fail = (m) => { if (box) box.innerHTML = '<span>' + m + '</span>'; };
  try {
    if (!window.isSecureContext || !window.crypto || !crypto.subtle || !window.DecompressionStream) return fail('This page needs a secure (https) connection and an up-to-date browser.');
    try { localStorage.setItem('tq_series', B.series); const e = localStorage.getItem('tq_engine'); if (e && !(B.eng || []).includes(e)) localStorage.setItem('tq_engine', ''); } catch (e) {}
    const r = await fetch('/api/v1/d/' + B.series.toLowerCase(), { headers: { 'X-BS-T': B.t }, credentials: 'same-origin', cache: 'no-store' });
    if (r.status === 429) { window.BSA && BSA('limit', B.series); return fail('You have opened a lot of cars in a short time. Please wait a few minutes, then reload the page.'); }
    if (r.status === 403) return fail('This page has expired. Reload it to see the torque specs.');
    if (!r.ok) return fail('Could not load the torque specs. Reload the page.');
    const kb = r.headers.get('X-BS-K') || '';
    const buf = new Uint8Array(await r.arrayBuffer());
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('__KA__' + '.' + kb + '.' + B.t));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    const txt = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    window.__BS_D = Object.assign(JSON.parse(txt), IDX);
    if (box) box.remove();
    window.BSA && BSA('car', B.series);
    const s = document.createElement('script'); s.src = '/assets/app.js?v=' + B.v; document.body.appendChild(s);
  } catch (e) { fail('Could not load the torque specs. Reload the page.'); }
})();
