/* BoltSpec – shared shell: header, footer, newsletter form, donate button, menu, toast. No framework.
   Site settings come from window.BS (set by the server in each page). */
(function () {
  const ls = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} } };
  const BS = window.BS || {};
  // language: BS.lang ('en'|'ro'), BS.p (URL prefix of this language), BS.alt ({en: url, ro: url} of this same page)
  const LANG = BS.lang || 'en', P = BS.p || '', TT = window.BS_T || {};
  const T = (s, ...a) => { let r = TT[s] || s; a.forEach((v, i) => { r = r.split('{' + i + '}').join(v); }); return r; };
  const LANGS = [['en', 'English', 'EN'], ['ro', 'Română', 'RO']];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls = '') => `<svg class="u-i ${cls}" aria-hidden="true"><use href="/assets/icons.svg#i-${n}"/></svg>`;

  // theme: applied right away, before rendering (no flash)
  function applyTheme(v) { const r = document.documentElement; if (v === 'light' || v === 'dark') r.dataset.theme = v; else delete r.dataset.theme; }
  applyTheme(ls.get('ui_theme'));
  const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25z"/><circle cx="16" cy="16" r="5.2" fill="var(--accent)"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>`;
  const WORDMARK = `<span class="b-wm">BOLT<b>SPEC</b></span>`;
  const donateUrl = BS.bmc ? 'https://www.buymeacoffee.com/' + encodeURIComponent(BS.bmc) : '';
  const donateBtn = (cls = '') => (donateUrl ? `<a class="b-coffee ${cls}" href="${donateUrl}" target="_blank" rel="noopener" aria-label="${T('Buy me a coffee (opens buymeacoffee.com)')}">${icon('coffee')}<span>${T('Buy me a coffee')}</span></a>` : '');

  function toast(msg, ic = 'check', ms = 3200) {
    let t = document.getElementById('u-toast');
    if (!t) { t = document.createElement('div'); t.id = 'u-toast'; t.className = 'u-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    const closable = ms > 5000; // long messages (with a link) get a close button
    t.innerHTML = (ic ? icon(ic, 'sm') : '') + `<span>${msg}</span>` + (closable ? `<button type="button" class="u-toast__x" aria-label="${T('Close')}">${icon('x', 'sm')}</button>` : '');
    if (closable) t.querySelector('.u-toast__x').onclick = () => t.classList.remove('show');
    t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
  }

  function openMenu(anchor) {
    document.querySelector('.u-menu')?.remove();
    const theme = ls.get('ui_theme') || 'auto';
    const m = document.createElement('div'); m.className = 'u-menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', T('Settings'));
    const opt = (k, v, t, on) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${on}">${t}</button>`;
    m.innerHTML = `<div class="u-menu__grp"><span class="u-menu__lbl">${T('Theme')}</span><div class="u-seg">${opt('theme', 'auto', T('Auto'), theme === 'auto')}${opt('theme', 'light', T('Light'), theme === 'light')}${opt('theme', 'dark', T('Dark'), theme === 'dark')}</div></div>
      <div class="u-menu__grp"><span class="u-menu__lbl">${T('Language')}</span><div class="u-seg">${langLinks()}</div></div>
      <div class="u-menu__links"><a href="${P}/#cars">${icon('car', 'sm')} ${T('All cars')}</a><a href="${P}/#news">${icon('mail', 'sm')} ${T('Newsletter')}</a><a href="${P}/about/">${icon('info', 'sm')} ${T('About and privacy')}</a>${donateUrl ? `<a href="${donateUrl}" target="_blank" rel="noopener">${icon('coffee', 'sm')} ${T('Buy me a coffee')}</a>` : ''}</div>`;
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

  // ---------- language ----------
  // link to this same page in another language; the choice is remembered so the Romanian suggestion is not shown again
  const altUrl = (l) => ((BS.alt && BS.alt[l]) || (l === 'en' ? '/' : '/' + l + '/')) + location.hash;
  const langLinks = (short) => LANGS.map(([l, name, ab]) => `<a href="${esc(altUrl(l))}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === LANG ? ' aria-current="true" aria-pressed="true"' : ' aria-pressed="false"'}${short ? ` title="${name}"` : ''}>${short ? ab : name}</a>`).join('');
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[data-lang]'); if (a) ls.set('ui_lang', a.dataset.lang); }, true);
  // a visitor whose browser prefers Romanian, on an English page, gets a small suggestion (never a redirect)
  function suggestLang() {
    if (LANG !== 'en' || !BS.alt || !BS.alt.ro || ls.get('ui_lang')) return;
    const pref = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map((x) => String(x).toLowerCase());
    if (!pref.some((x) => x === 'ro' || x.startsWith('ro-') || x === 'mo')) return;
    const bar = document.createElement('div'); bar.className = 'b-langhint'; bar.lang = 'ro'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Limba');
    bar.innerHTML = `<span>BoltSpec este disponibil și în limba română.</span><a class="u-btn u-btn--primary u-btn--sm" href="${esc(altUrl('ro'))}" hreflang="ro" data-lang="ro">Deschide în română</a><button type="button" class="u-iconbtn" aria-label="Închide (rămâi în engleză)">${icon('x', 'sm')}</button>`;
    bar.querySelector('button').onclick = () => { ls.set('ui_lang', 'en'); bar.remove(); };
    const host = document.getElementById('u-shell'); host.insertAdjacentElement('afterend', bar);
  }

  // ---------- newsletter (double opt-in) ----------
  function newsForm(id) {
    return `<form class="b-news" id="${id}" novalidate>
      <label class="u-sr" for="${id}-e">${T('E-mail address')}</label>
      <div class="b-news__row"><input id="${id}-e" type="email" name="email" aria-describedby="${id}-m" autocomplete="email" required placeholder="${T('your@email.com')}"><button class="u-btn u-btn--primary" type="submit">${T('Subscribe')}</button></div>
      <p class="b-news__fine">${T('Occasional e-mails about new cars, features and data updates. Nothing else. Unsubscribe with one click.')} <a href="${P}/about/#privacy">${T('Privacy')}</a></p>
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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say(T('Please enter a valid e-mail address.'), true); input.focus(); return; }
      form.dataset.busy = '1'; btn.disabled = true; say('', false);
      try {
        const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, lang: LANG }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) { BSA('newsletter'); say(T('Almost done: check your inbox and confirm your address.')); input.value = ''; }
        else say(d.error === 'rate' ? T('Too many attempts. Try again later.') : T('That did not work. Check the address and try again.'), true);
      } catch { say(T('That did not work. Check your connection and try again.'), true); }
      delete form.dataset.busy; btn.disabled = false;
    });
  }


  function render() {
    const host = document.getElementById('u-shell') || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    host.id = 'u-shell'; host.className = 'u-shell';
    host.innerHTML = `
      <a href="#main" class="u-sr">${T('Skip to content')}</a>
      <div class="u-shell__bar">
        <a class="u-brand" href="${P}/" aria-label="${T('BoltSpec – home')}">${MARK}${WORDMARK}</a>
        <span class="b-tag">${T('for BMW, MINI & Rolls-Royce')}</span>
        <span class="u-shell__spacer"></span>
        <a class="u-carbtn" href="${P}/#cars">${icon('car')}<span class="t">${BS.series ? esc(BS.series) : T('Choose car')}</span></a>
        <nav class="b-lang" aria-label="${T('Language')}">${langLinks(true)}</nav>
        ${donateBtn('b-coffee--head')}
        <button class="u-iconbtn" id="u-menubtn" type="button" aria-label="${T('Settings')}" title="${T('Settings')}" aria-haspopup="dialog" aria-expanded="false">${icon('more')}</button>
      </div>
      <div class="u-scale" aria-hidden="true"></div>`;
    const ft = document.createElement('footer'); ft.className = 'u-foot b-foot';
    ft.innerHTML = `<div class="u-foot__in">
      <section class="b-foot__news" id="news" aria-labelledby="news-h"><h2 id="news-h">${T('Get updates')}</h2>${newsForm('nf')}</section>
      ${donateUrl ? `<section class="b-foot__coffee"><h2>${T('Useful?')}</h2><p>${T('BoltSpec is free and has no ads. A coffee helps keep it online and up to date.')}</p>${donateBtn()}</section>` : ''}
      <div class="b-foot__meta"><span><b>BoltSpec</b> · ${T('Tightening torques and service data for BMW, MINI and Rolls-Royce.')}</span>
      <nav aria-label="${T('Information')}"><a href="${P}/about/">${T('About and privacy')}</a>${LANGS.filter(([l]) => l !== LANG).map(([l, name]) => `<a href="${esc(altUrl(l))}" hreflang="${l}" lang="${l}" data-lang="${l}">${name}</a>`).join('')}${BS.contact ? `<a href="mailto:${esc(BS.contact)}">${esc(BS.contact)}</a>` : ''}</nav>
      <span class="u-foot__sm">${T('Not affiliated with BMW AG. BMW, MINI and Rolls-Royce are trademarks of BMW AG. Values are for reference: always check the official documentation.')}</span></div></div>`;
    (document.getElementById('main') || document.body).insertAdjacentElement('afterend', ft);
    bindNews(ft.querySelector('#nf'));
    host.querySelector('#u-menubtn').addEventListener('click', (e) => openMenu(e.currentTarget));
    suggestLang();
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
    setTimeout(() => toast(`${T('Saving you time?')} <a href="${donateUrl}" target="_blank" rel="noopener">${T('Buy me a coffee')}</a>`, 'coffee', 10000), 1200);
  }
  document.addEventListener('copy', noteCopy);

  window.UShell = { esc, icon, toast, noteCopy, newsForm, bindNews, T, lang: LANG, sync() {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
