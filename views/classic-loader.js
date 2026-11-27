// Classic model page loader: fetches this model's encrypted data, decrypts it in the browser and renders the variants.
// Minified and inlined by the server, which fills in half of the key for each page.
(async () => {
  const B = window.BS, box = document.getElementById('bsLoad'), out = document.getElementById('cl');
  if (box) box.textContent = 'Loading the data…';
  const fail = (m) => { if (box) box.innerHTML = '<span>' + m + '</span>'; };
  try {
    if (!window.isSecureContext || !window.crypto || !crypto.subtle || !window.DecompressionStream) return fail('This page needs a secure (https) connection and an up-to-date browser.');
    const r = await fetch('/api/v1/c/' + B.make + '/' + B.model, { headers: { 'X-BS-T': B.t }, credentials: 'same-origin', cache: 'no-store' });
    if (r.status === 429) { window.BSA && BSA('limit', B.key); return fail('You have opened a lot of cars in a short time. Please wait a few minutes, then reload the page.'); }
    if (r.status === 403) return fail('This page has expired. Reload it to see the data.');
    if (!r.ok) return fail('Could not load the data. Reload the page.');
    const kb = r.headers.get('X-BS-K') || '';
    const buf = new Uint8Array(await r.arrayBuffer());
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('__KA__' + '.' + kb + '.' + B.t));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    const D = JSON.parse(await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    if (box) box.textContent = '';
    window.BSA && BSA('car', B.key);
    // the variant rows are already in the page; the shared component binds to them and fills the details on open
    window.BSD.mount(out, D.H || [], { key: B.key });
  } catch (e) { fail('Could not load the data. Reload the page.'); }
})();
