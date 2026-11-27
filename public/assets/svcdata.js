// Service data (data book, per engine variant): one component for the classic model pages and the BMW "Engine data" tab.
// The server uses list() to render the variant rows into the page (no values in them); in the browser mount() binds to
// those rows (or renders them) and fills a variant's details when it is opened.
// Variant: { m: model names, y: years, t: engine type, c: engine code, kw, l: litres, k: key specs, d: [[section, rows]],
//            n: { footnote: text }, x: [general notes] }   row / key spec: [label, value, unit, [footnotes]]
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const OPEN = { 'Torque settings': 1, Capacities: 1 };
  // fixed columns, so opening a section never moves the others
  const COLS = [['Torque settings'], ['Capacities', 'Engine & cooling'], ['Ignition', 'Fuel system', 'Brakes, tyres & alignment', 'Electrical', 'Notes']];
  // abbreviations, as defined in the data book's introduction
  const CODES = { N: 'new bolts / nuts', WSM: 'refer to the workshop manual or the manufacturer', LkC: 'locking compound on the thread', WT: 'included with the transmission (no separate figure)',
    PW: 'per wheel', H: 'hot', C: 'cold', Hyd: 'hydraulic adjusters (no adjustment)', 'N/A': 'not adjustable / not applicable', AT: 'automatic transmission', MT: 'manual transmission',
    OHB: "owner's handbook", 'U/L': 'unladen', L: 'laden', TWS: 'torque wrench setting', TDC: 'top dead centre', BTDC: 'before top dead centre', ATDC: 'after top dead centre',
    '[U]': 'unleaded fuel only', '[L]': 'leaded fuel only', '[E]': 'unleaded or leaded, no adjustment', '[R]': 'refer to the manufacturer', '[RA]': 'adjust the engine (usually ignition timing) for unleaded',
    'E 91 RON': '91 RON unleaded is suitable', 'E 95 RON': '95 RON unleaded is suitable', 'E 98 RON': '98 RON unleaded is suitable' };
  const CYL = { F: 'front', FE: 'flywheel end', FEL: 'flywheel end, left', FER: 'flywheel end, right', FL: 'front left', FR: 'front right', PEL: 'pulley end, left', PER: 'pulley end, right',
    R: 'rear', RL: 'rear left', RR: 'rear right', TBE: 'timing belt end', TCE: 'timing chain end', TGF: 'timing gear, front bank', TGR: 'timing gear, rear bank' };
  const ONE = { N: 1, H: 1, C: 1, L: 1 }; // single letters count only right after a number ("30 Nm N", "0.20 H")
  function codesIn(v) {
    const found = {};
    for (const [, rs] of v.d) for (const r of rs) {
      const x = String(r[1]);
      if (/^No 1 cylinder position/i.test(r[0])) { const c = x.trim(); if (CYL[c]) found['cyl:' + c] = `No 1 cylinder: ${c} = ${CYL[c]}`; continue; }
      for (const k of Object.keys(CODES)) {
        const re = ONE[k] ? new RegExp(`\\d(?:\\s?(?:Nm|mm|bar|L|°))?\\s${k}\\b`) : k.startsWith('[') ? null : new RegExp(`(^|[\\s(\\[/])${k.replace(/[/]/g, '\\/')}(?=$|[\\s).,:\\]])`);
        if (re ? re.test(x) : x.includes(k)) found[k] = `${k} = ${CODES[k]}`;
      }
    }
    return Object.values(found);
  }
  const CHEV = '<svg class="sd-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // stable order and ids: by engine size, then code, then years
  function sorted(H) {
    const vs = H.map((v, i) => ({ v, i }));
    vs.sort((a, b) => (parseFloat(a.v.l) || 99) - (parseFloat(b.v.l) || 99) || String(a.v.c).localeCompare(String(b.v.c), 'en', { numeric: true }) || a.v.y.localeCompare(b.v.y) || a.i - b.i);
    const seen = {};
    vs.forEach((x) => { let id = 'v-' + (slug(x.v.c + '-' + x.v.y) || x.i); if (seen[id]) id += '-' + x.i; seen[id] = 1; x.id = id; });
    return vs;
  }
  const spec = (v) => [v.l && v.l + ' L', v.kw && v.kw + ' kW'].filter(Boolean).join(' · ');
  const query = (v) => [v.c, v.l, v.l && v.l + 'l', v.kw && v.kw + 'kw', v.m, v.y, v.t].filter(Boolean).join(' ').toLowerCase();

  function summary(v) {
    return `<summary class="sd-sum"><span class="sd-code${v.c ? '' : ' sd-nocode'}">${esc(v.c || '')}</span><span class="sd-spec">${esc(spec(v))}</span><span class="sd-years">${esc(v.y)}</span><span class="sd-name">${esc(v.m)}</span>${CHEV}</summary>`;
  }
  // the list of variants, grouped by engine size when there are many. Bodies are empty until opened.
  function list(H) {
    const vs = sorted(H), group = vs.length > 6;
    let out = '', last = null;
    for (const x of vs) {
      const g = x.v.l ? x.v.l + ' L' : 'Other';
      if (group && g !== last) { out += `<h3 class="sd-grp" data-g="${esc(g)}">${esc(g)}</h3>`; last = g; }
      out += `<details class="sdv" name="sdv" id="${x.id}" data-i="${x.i}" data-g="${esc(g)}" data-q="${esc(query(x.v))}">${summary(x.v)}<div class="sd-body"><p class="muted sd-wait">Loading…</p></div></details>`;
    }
    return `<div class="sd-list">${out}</div>`;
  }
  function toolbar(n, legend) {
    return `<div class="sd-tools noprint">${n > 6 ? `<label for="sdq" class="sr">Filter engine variants</label><input id="sdq" class="sd-q" type="search" placeholder="Filter: engine code, 1.6, 16V, 1992" autocomplete="off" spellcheck="false">` : ''}<span class="sd-count muted" id="sdn" role="status" aria-live="polite"></span></div>${legend ? '<p class="sd-legend muted">Tap your engine to see its data. <b>[ ]</b> = value for automatic gearbox or the alternative version. Valve clearances are cold and tyre pressures cold and unladen, unless stated. Codes are explained inside each engine.</p>' : ''}`;
  }

  // ---------- one variant's details ----------
  const fn = (a) => (a && a.length ? a.map((n) => `<sup class="sd-fn" title="Note ${n}">${n}</sup>`).join('') : '');
  const val = (r) => `<span class="sd-v">${esc(r[1])}</span>${r[2] ? `&nbsp;<span class="sd-u">${esc(r[2])}</span>` : ''}${fn(r[3])}`;
  const notes = (v, fns, cls) => (fns || []).filter((n) => v.n && v.n[n]).map((n) => `<div class="${cls}"><sup class="sd-fn">${n}</sup> ${esc(v.n[n])}</div>`).join('');
  function rows(v, rs) {
    let out = ''; const shown = new Set();
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i], [pre, rest] = splitPre(r[0]);
      const sameNext = rest && rs[i + 1] && splitPre(rs[i + 1][0])[0] === pre, samePrev = rest && rs[i - 1] && splitPre(rs[i - 1][0])[0] === pre;
      if (rest && sameNext && !samePrev) out += `<tr class="sd-sub"><th colspan="2">${esc(pre)}</th></tr>`;
      const lbl = rest && (sameNext || samePrev) ? `<span class="sd-in">${esc(rest.charAt(0).toUpperCase() + rest.slice(1))}</span>` : esc(r[0]);
      out += `<tr><td class="sd-l">${lbl}</td><td class="sd-r">${val(r)}</td></tr>`;
      // a note is printed once, under the last row of a run that uses it (e.g. after cylinder head stage 4)
      const due = (r[3] || []).filter((n) => !shown.has(n) && !(rs[i + 1] && (rs[i + 1][3] || []).includes(n)));
      due.forEach((n) => shown.add(n));
      const nt = notes(v, due, 'sd-rownote');
      if (nt) out += `<tr class="sd-nrow"><td colspan="2">${nt}</td></tr>`;
    }
    return out;
  }
  function splitPre(l) { const i = l.indexOf(' · '); return i > 0 ? [l.slice(0, i), l.slice(i + 3)] : [l, '']; }
  function body(v) {
    const key = v.k && v.k.length ? `<div class="sd-key"><h4 class="sd-h">Key specs</h4><dl>${v.k.map((k) => `<div><dt>${esc(k[0])}</dt><dd>${val(k)}</dd></div>`).join('')}</dl>${notes(v, [...new Set(v.k.flatMap((k) => k[3] || []))], 'sd-keynote')}</div>` : '';
    const html = {};
    for (const [t, rs] of v.d) html[t] = `<details class="sd-sec"${OPEN[t] ? ' open' : ''}><summary><span>${esc(t)}</span> <span class="sd-cnt">${rs.length}</span></summary><table>${rows(v, rs)}</table></details>`;
    if (v.x && v.x.length) html.Notes = `<details class="sd-sec" open><summary><span>Notes</span> <span class="sd-cnt">${v.x.length}</span></summary><ul class="sd-notes">${v.x.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>`;
    const cols = COLS.map((c) => `<div class="sd-col">${c.map((t) => html[t] || '').join('')}</div>`).join('');
    const cs = codesIn(v);
    const codes = cs.length ? `<p class="sd-codes"><b>Codes:</b> ${cs.map(esc).join(' · ')}</p>` : '';
    return `<p class="sd-meta"><b>${esc(v.m)}</b> · ${esc(v.y)}${v.t ? ' · ' + esc(v.t) : ''}</p>${key}${codes}<div class="sd-acts noprint"><button type="button" class="btn sec sd-all">Expand all</button><button type="button" class="btn sec sd-print">Print this engine</button></div><div class="sd-cols">${cols}</div>`;
  }

  // ---------- browser: bind to the rows and fill details on open ----------
  function mount(el, H, opts) {
    opts = opts || {};
    if (!el.querySelector('.sd-list')) el.innerHTML = toolbar(H.length, true) + list(H) + '<p class="muted sd-none" hidden>No engine matches.</p>';
    const LS = 'bs_sd:' + (opts.key || location.pathname);
    const items = [...el.querySelectorAll('.sdv')];
    const fill = (d) => { if (d.dataset.ok) return; const v = H[+d.dataset.i]; if (!v) return; d.querySelector('.sd-body').innerHTML = body(v); d.dataset.ok = '1'; };
    items.forEach((d) => {
      if (d.open) fill(d);
      d.addEventListener('toggle', () => {
        if (!d.open) return;
        fill(d);
        items.forEach((o) => { if (o !== d && o.open) o.open = false; }); // one engine at a time (fallback for browsers without details[name])
        try { history.replaceState(null, '', '#' + d.id); localStorage.setItem(LS, d.id); } catch (e) {}
        if (window.BSA) window.BSA('engine', (opts.key || '') + ':' + (H[+d.dataset.i] || {}).c);
      });
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.closest('.sdv'); if (!d) return;
      if (b.classList.contains('sd-all')) { const secs = [...d.querySelectorAll('.sd-sec')], open = !secs.every((s) => s.open); secs.forEach((s) => (s.open = open)); b.textContent = open ? 'Collapse all' : 'Expand all'; }
      if (b.classList.contains('sd-print')) { document.body.classList.add('sd-printing'); d.querySelectorAll('.sd-sec').forEach((s) => (s.open = true)); addEventListener('afterprint', () => document.body.classList.remove('sd-printing'), { once: true }); window.print(); }
    });
    // filter: every word must match; group headers follow their rows; a single match opens itself
    const q = el.querySelector('.sd-q'), cnt = el.querySelector('.sd-count'), none = el.querySelector('.sd-none');
    if (q) q.addEventListener('input', () => {
      const t = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean); let n = 0, only = null;
      items.forEach((d) => { const on = t.every((w) => d.dataset.q.includes(w)); d.hidden = !on; if (on) { n++; only = d; } });
      el.querySelectorAll('.sd-grp').forEach((h) => { h.hidden = !items.some((d) => !d.hidden && d.dataset.g === h.dataset.g); });
      cnt.textContent = t.length ? `${n} of ${items.length}` : '';
      if (none) none.hidden = n > 0;
      if (n === 1 && !only.open) only.open = true;
    });
    // open the engine from the link (#v-…) or the one this visitor looked at last
    let start = location.hash && el.querySelector(location.hash.replace(/[^#\w-]/g, ''));
    if (!start) { try { const id = localStorage.getItem(LS); if (id) start = el.querySelector('#' + id.replace(/[^\w-]/g, '')); } catch (e) {} }
    if (!start && items.length === 1) start = items[0];
    if (start && start.classList.contains('sdv')) { start.open = true; fill(start); if (location.hash) start.scrollIntoView({ block: 'start' }); }
  }

  const API = { list, toolbar, mount, body, sorted };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BSD = API;
})(this);
