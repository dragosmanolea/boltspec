/* BoltSpec – shared shell: header, footer, newsletter form, donate button, menu, toast. No framework.
   Site settings come from window.BS (set by the server in each page). */
(function () {
  const ls = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} } };
  const BS = window.BS || {};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls = '') => `<svg class="u-i ${cls}" aria-hidden="true"><use href="/assets/icons.svg#i-${n}"/></svg>`;

  // theme: applied right away, before rendering (no flash)
  function applyTheme(v) { const r = document.documentElement; if (v === 'light' || v === 'dark') r.dataset.theme = v; else delete r.dataset.theme; }
  applyTheme(ls.get('ui_theme'));
  const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25z"/><circle cx="16" cy="16" r="5.2" fill="var(--accent)"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>`;
  const WORDMARK = `<span class="b-wm">BOLT<b>SPEC</b></span>`;
  const donateUrl = BS.bmc ? 'https://www.buymeacoffee.com/' + encodeURIComponent(BS.bmc) : '';
  const donateBtn = (cls = '') => (donateUrl ? `<a class="b-coffee ${cls}" href="${donateUrl}" target="_blank" rel="noopener" aria-label="Buy me a coffee (opens buymeacoffee.com)">${icon('coffee')}<span>Buy me a coffee</span></a>` : '');

  function toast(msg, ic = 'check', ms = 3200) {
    let t = document.getElementById('u-toast');
    if (!t) { t = document.createElement('div'); t.id = 'u-toast'; t.className = 'u-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    const closable = ms > 5000; // long messages (with a link) get a close button
    t.innerHTML = (ic ? icon(ic, 'sm') : '') + `<span>${msg}</span>` + (closable ? `<button type="button" class="u-toast__x" aria-label="Close">${icon('x', 'sm')}</button>` : '');
    if (closable) t.querySelector('.u-toast__x').onclick = () => t.classList.remove('show');
    t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
  }

  function openMenu(anchor) {
    document.querySelector('.u-menu')?.remove();
    const theme = ls.get('ui_theme') || 'auto';
    const m = document.createElement('div'); m.className = 'u-menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Settings');
    const opt = (k, v, t, on) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${on}">${t}</button>`;
    m.innerHTML = `<div class="u-menu__grp"><span class="u-menu__lbl">Theme</span><div class="u-seg">${opt('theme', 'auto', 'Auto', theme === 'auto')}${opt('theme', 'light', 'Light', theme === 'light')}${opt('theme', 'dark', 'Dark', theme === 'dark')}</div></div>
      <div class="u-menu__links"><a href="/#cars">${icon('car', 'sm')} All cars</a><a href="/#news">${icon('mail', 'sm')} Newsletter</a><a href="/about/">${icon('info', 'sm')} About and privacy</a>${donateUrl ? `<a href="${donateUrl}" target="_blank" rel="noopener">${icon('coffee', 'sm')} Buy me a coffee</a>` : ''}</div>`;
    anchor.insertAdjacentElement('afterend', m); anchor.setAttribute('aria-expanded', 'true');
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px';
    m.style.right = Math.max(8, innerWidth - r.right) + 'px';
    const close = () => { m.remove(); anchor.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', out, true); document.removeEventListener('keydown', key); };
    const out = (e) => { if (!m.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); };
    const key = (e) => { if (e.key === 'Escape') { close(); anchor.focus(); } };
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      if (b.dataset.k === 'theme') { ls.set('ui_theme', b.dataset.v === 'auto' ? '' : b.dataset.v); applyTheme(b.dataset.v); m.querySelectorAll('[data-k=theme]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }
    });
    m.addEventListener('focusout', (e) => { if (!e.relatedTarget || (!m.contains(e.relatedTarget) && e.relatedTarget !== anchor)) close(); });
    setTimeout(() => { document.addEventListener('click', out, true); document.addEventListener('keydown', key); }, 0);
    m.querySelector('button').focus();
  }

  // ---------- newsletter (double opt-in) ----------
  function newsForm(id) {
    return `<form class="b-news" id="${id}" novalidate>
      <label class="u-sr" for="${id}-e">E-mail address</label>
      <div class="b-news__row"><input id="${id}-e" type="email" name="email" aria-describedby="${id}-m" autocomplete="email" required placeholder="your@email.com"><button class="u-btn u-btn--primary" type="submit">Subscribe</button></div>
      <p class="b-news__fine">Occasional e-mails about new cars, features and data updates. Nothing else. Unsubscribe with one click. <a href="/about/#privacy">Privacy</a></p>
      <p class="b-news__msg" id="${id}-m" role="status" aria-live="polite"></p></form>`;
  }
  function bindNews(form) {
    if (!form) return;
    const msg = form.querySelector('.b-news__msg'), btn = form.querySelector('button'), input = form.email;
    const say = (text, err) => { msg.textContent = text; msg.classList.toggle('is-err', !!err); input.setAttribute('aria-invalid', err ? 'true' : 'false'); };
    input.addEventListener('input', () => { if (msg.classList.contains('is-err')) say('', false); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.dataset.busy) return;
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('Please enter a valid e-mail address.', true); input.focus(); return; }
      form.dataset.busy = '1'; btn.disabled = true; say('', false);
      try {
        const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) { BSA('newsletter'); say('Almost done: check your inbox and confirm your address.'); input.value = ''; }
        else say(d.error === 'rate' ? 'Too many attempts. Try again later.' : 'That did not work. Check the address and try again.', true);
      } catch { say('That did not work. Check your connection and try again.', true); }
      delete form.dataset.busy; btn.disabled = false;
    });
  }


  function render() {
    const host = document.getElementById('u-shell') || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    host.id = 'u-shell'; host.className = 'u-shell';
    host.innerHTML = `
      <a href="#main" class="u-sr">Skip to content</a>
      <div class="u-shell__bar">
        <a class="u-brand" href="/" aria-label="BoltSpec – home">${MARK}${WORDMARK}</a>
        <span class="b-tag">${BS.classic ? 'torque &amp; service data' : 'for BMW, MINI &amp; Rolls-Royce'}</span>
        <span class="u-shell__spacer"></span>
        <a class="u-carbtn" href="${esc(BS.carHref || '/#cars')}" title="Change car">${icon('car')}<span class="t">${BS.series ? esc(BS.series) : BS.carLabel ? esc(BS.carLabel) : 'Choose car'}</span></a>
        ${donateBtn('b-coffee--head')}
        <button class="u-iconbtn" id="u-menubtn" type="button" aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded="false">${icon('more')}</button>
      </div>
      <div class="u-scale" aria-hidden="true"></div>`;
    const ft = document.createElement('footer'); ft.className = 'u-foot b-foot';
    ft.innerHTML = `<div class="u-foot__in">
      <section class="b-foot__news" id="news" aria-labelledby="news-h"><h2 id="news-h">Get updates</h2>${newsForm('nf')}</section>
      ${donateUrl ? `<section class="b-foot__coffee"><h2>Useful?</h2><p>BoltSpec is free and has no ads. A coffee helps keep it online and up to date.</p>${donateBtn()}</section>` : ''}
      <div class="b-foot__meta"><span><b>BoltSpec</b> · Tightening torques and service data for BMW, MINI and Rolls-Royce${BS.classic ? ', plus classic cars from 1980–1997' : ''}.</span>
      <nav aria-label="Information"><a href="/about/">About and privacy</a>${BS.contact ? `<a href="mailto:${esc(BS.contact)}">${esc(BS.contact)}</a>` : ''}</nav>
      <span class="u-foot__sm">${BS.classic ? 'Not affiliated with any vehicle manufacturer. All names and trademarks belong to their owners.' : 'Not affiliated with BMW AG. BMW, MINI and Rolls-Royce are trademarks of BMW AG.'} Values are for reference: always check the official documentation.</span></div></div>`;
    (document.getElementById('main') || document.body).insertAdjacentElement('afterend', ft);
    bindNews(ft.querySelector('#nf'));
    host.querySelector('#u-menubtn').addEventListener('click', (e) => openMenu(e.currentTarget));
  }
  // ---------- cookieless analytics: one small beacon per event, nothing stored on the device ----------
  const BSA = (n, v, c) => {
    if (navigator.webdriver || /^\/admin/.test(location.pathname)) return;
    const d = { n, p: location.pathname, v, c, w: innerWidth };
    if (n === 'pv') {
      const u = new URLSearchParams(location.search);
      Object.assign(d, { r: document.referrer, us: u.get('utm_source') || u.get('ref') || '', um: u.get('utm_medium') || '', uc: u.get('utm_campaign') || '' });
    }
    try { navigator.sendBeacon('/api/e', new Blob([JSON.stringify(d)], { type: 'text/plain' })); } catch {}
  };
  window.BSA = BSA;
  BSA('pv');
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.b-coffee, .u-toast a[href*="buymeacoffee"]');
    if (a) BSA('coffee', a.closest('.u-shell__bar, #u-shell') ? 'header' : a.closest('.u-foot__in, footer') ? 'footer' : 'toast');
  }, true);

  // a gentle donate reminder after someone has copied a few values (once per session)
  let copies = 0;
  function noteCopy() {
    if (copies < 50) BSA('copy');
    if (!donateUrl || ++copies !== 3) return;
    try { if (sessionStorage.getItem('bs_nudge')) return; sessionStorage.setItem('bs_nudge', '1'); } catch {}
    setTimeout(() => toast(`Saving you time? <a href="${donateUrl}" target="_blank" rel="noopener">Buy me a coffee</a>`, 'coffee', 10000), 1200);
  }
  document.addEventListener('copy', noteCopy);

  window.UShell = { esc, icon, toast, noteCopy, newsForm, bindNews, sync() {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
