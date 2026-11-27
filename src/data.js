// The ISTA dataset, kept on the server. The browser only ever gets one series at a time (see slice()).
const fs = require('fs');
const path = require('path');

const D = require('./dataset'); // same object torque.js uses, so the clean-up below applies to both (local-data/ when running locally)
const S = D.S;
const NAMES = D.NAMES || {};
clean(D);
const torque = require('./torque'); // loaded after the clean-up

// ---------- one-time clean-up of the extracted ISTA data (fixes found by the data QA) ----------
function clean(D) {
  const S = D.S, add = (t) => { const i = S.indexOf(t); return i >= 0 ? i : S.push(t) - 1; };
  // group names missing from the source
  Object.assign(D.GE, { 66: D.GE[66] || 'Driver assistance and cameras', 67: D.GE[67] || 'Electrical drives', 71: D.GE[71] || 'Equipment and towing', 84: D.GE[84] || 'Communication systems' });
  // "B40/B42/B44" are displacement codes (N63B44…), not engine families
  for (const k of Object.keys(D.SE)) D.SE[k] = D.SE[k].filter((e) => !/^B4[0-4]$/.test(e));
  // value typos
  for (const r of D.R) { const v = S[r[6]]; if (v && /±±/.test(v)) r[6] = add(v.replace(/±±/g, '±')); }
  // subgroup names that differ only by case, hyphens or spacing -> one spelling (the most used one)
  const norm = (t) => String(t || '').toLowerCase().replace(/[-‐–]/g, ' ').replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').trim();
  const use = new Map(); for (const r of D.R) use.set(r[1], (use.get(r[1]) || 0) + 1);
  const best = new Map();
  for (const [i, n] of use) { const k = norm(S[i]); const b = best.get(k); if (!b || n > b.n) best.set(k, { i, n }); }
  for (const r of D.R) r[1] = best.get(norm(S[r[1]])).i;
  // generic rows (no series, no engine): keep only the standard thread tables (group 00); the rest
  // (e.g. gearbox values) would show up on every car, including cars that never had that gearbox
  const lh = new Set(D.LH || []);
  let rows = D.R.map((r, i) => ({ r, lh: lh.has(i) })).filter(({ r }) => r[7].length || r[8].length || !r[11] || r[0] === '00');
  // rows that differ only in the engine-variant label are merged; the labels are listed together
  const groups = new Map();
  for (const x of rows) {
    const r = x.r, k = [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7].join(','), r[8].join(','), r[10], r[11], JSON.stringify(r[12] || null)].join('|');
    const g = groups.get(k);
    if (!g) groups.set(k, { ...x, labels: [r[9]] }); else { if (!g.labels.includes(r[9])) g.labels.push(r[9]); g.lh = g.lh || x.lh; }
  }
  D.R = []; D.LH = [];
  for (const g of groups.values()) {
    const r = g.r.slice();
    if (g.labels.length > 1) { const t = [...new Set(g.labels.map((i) => S[i]).filter(Boolean))]; r[9] = t.length ? add(t.join(' · ')) : g.labels[0]; }
    if (g.lh) D.LH.push(D.R.length);
    D.R.push(r);
  }
}

// public index: which cars exist and how many torque specs each has (no values in it)
const ser = (r) => r[7].map((i) => S[i]);
const NOT_BMW = /^(W16|KARSAN|MORGAN|MOTIV)$/;
const CANDIDATES = [...new Set(D.R.flatMap(ser))].filter((s) => !NOT_BMW.test(s)).sort();
const GENERIC = D.R.filter((r) => !r[7].length && !r[8].length).length; // standard thread tables, shown on every car
const ALLS = [], SCNT = {};
const MIN_SPECS = 25; // cars with fewer real (non-generic) specs than this are left out: the page would be nearly empty

// brand groups, same order and rules as the module's car picker
const BRANDS = [
  ['BMW (E)', (s) => /^E\d\d$/.test(s)], ['BMW (F)', (s) => /^F\d\d$/.test(s) && !/^F5[4-8]|^F60/.test(s)], ['BMW (G)', (s) => /^G\d\d$/.test(s)],
  ['BMW i / U', (s) => /^[IU]\d\d$/.test(s)], ['MINI', (s) => /^R\d\d$/.test(s) || /^F5[4-8]|^F60/.test(s)], ['Rolls-Royce', (s) => /^RR\d+$/.test(s)],
];
const brandOf = (s) => (BRANDS.find(([, f]) => f(s)) || ['BMW'])[0];
const make = (s) => (/^RR/.test(s) ? 'Rolls-Royce' : brandOf(s) === 'MINI' ? 'MINI' : 'BMW');
const label = (s) => { const m = make(s), n = (NAMES[s] || '').replace(new RegExp('^' + m + '\\s*'), ''); return `${m} ${s}${n ? ' ' + n : ''}`; }; // "BMW F10 5 Series Sedan", "MINI R56 Hatch (2006–13)"

// One series: its rows (with series/engine lists narrowed to it), the strings they use (re-numbered), capacities.
const memo = new Map();
function slice(series) {
  if (memo.has(series)) return memo.get(series);
  const iS = S.indexOf(series);
  const engs = new Set(D.SE[series] || []);
  const iE = new Set([...engs].map((e) => S.indexOf(e)).filter((i) => i >= 0));
  // engines fitted only to some variants of this series (M3, Z3 M…): reachable through "Other engine", not in "All"
  const iV = new Set(Object.keys((D.SEV || {})[series] || {}).map((e) => S.indexOf(e)).filter((i) => i >= 0));
  // v2 rows carry validity blocks (r[12] = [[series], [engines], [except-engines]], alternatives from ISTA).
  // Turned into the simple series/engine lists the torque module understands, for this one series.
  const resolve = (blocks) => {
    const bl = blocks.filter((b) => !b[0].length || b[0].includes(iS));
    if (!bl.length) return null;
    const eS = new Set(), eE = new Set(); let all = false;
    for (const b of bl) {
      if (b[0].length) { if (!b[1].length) all = true; else b[1].forEach((e) => eS.add(e)); }
      else b[1].forEach((e) => { if (iE.has(e) || iV.has(e)) eE.add(e); });
    }
    if (all) return [[iS], []];
    const en = [...new Set([...eS, ...eE])];
    if (!en.length) return null;
    // series-specific row with at least one regular engine -> shown under "All"; variant-only -> engine-only row (hidden under "All")
    return [...eS].some((e) => iE.has(e)) ? [[iS], en] : [[], en];
  };
  const lh = new Set(D.LH || []);
  const rows = [], LHn = [];
  D.R.forEach((r, i) => {
    if (r[12] && r[12].length) {
      const v = resolve(r[12]); if (!v) return;
      const n = r.slice(0, 12); n[7] = v[0]; n[8] = v[1];
      if (lh.has(i)) LHn.push(rows.length);
      rows.push(n); return;
    }
    const sr = r[7], en = r[8];
    if (sr.length && !sr.includes(iS)) return;
    if (!sr.length && !en.length && !r[11]) return;
    if (!sr.length && en.length && !en.some((e) => iE.has(e))) return;
    const n = r.slice(); n[7] = sr.length ? [iS] : []; n[8] = en.filter((e) => iE.has(e));
    if (en.length && !n[8].length && !sr.length) return;
    if (lh.has(i)) LHn.push(rows.length);
    rows.push(n);
  });
  // compact string table: only what these rows use
  const map = new Map(), S2 = [];
  const use = (i) => { if (!Number.isInteger(i) || i < 0) return i; if (!map.has(i)) { map.set(i, S2.length); S2.push(S[i]); } return map.get(i); };
  rows.forEach((n) => { [1, 2, 3, 4, 5, 6, 9, 10].forEach((c) => { n[c] = use(n[c]); }); n[7] = n[7].map(use); n[8] = n[8].map(use); });
  const C = D.C.filter((c) => (c.s.length ? c.s.includes(series) : c.e.some((e) => engs.has(e))))
    .map((c) => ({ ...c, s: c.s.length ? [series] : [], e: c.e.filter((e) => engs.has(e)) }));
  const out = { S: S2, R: rows, LH: LHn, C };
  // pre-serialised once; the per-visitor watermark is appended to S when sending
  const json = JSON.stringify(out);
  const groups = {}; rows.forEach((n) => { groups[n[0]] = (groups[n[0]] || 0) + 1; });
  // the watermark goes at the end of S, so no index moves
  const res = { json, sEnd: json.indexOf('],"R":['), rows: rows.length, groups };
  memo.set(series, res);
  return res;
}
// JSON for one visitor: same data, plus an unused string that identifies who received it (traceable if copied)
function sliceJson(series, mark) {
  const { json, sEnd } = slice(series);
  return json.slice(0, sEnd) + ',' + JSON.stringify(mark) + json.slice(sEnd);
}

// What a car page shows without JavaScript: groups with counts and a few common values.
// category → the part people usually look for in it
const POPULAR = [['wheels', /wheel (bolt|stud|nut)|lug/i], ['drainplug', /^(?!.*coolant).*(oil drain|drain plug.*oil|oil.*drain plug)/i], ['sparkplugs', /spark plug/i], ['brakes', /caliper (at|to) (swivel|wheel)|brake carrier|guide bolt|brake disc/i], ['oilfilter', /oil filter/i], ['shocks', /shock absorber|strut/i]];
function seo(series) {
  const { groups, rows } = slice(series);
  const popular = [];
  for (const [id, re] of POPULAR) {
    const r = torque.lookup({ category: id, series, limit: 60 });
    if (!r.rows || !r.rows.length) continue;
    const best = r.rows.filter((x) => re.test(x.part) || re.test(x.sub));
    popular.push({ id, name: r.category.name, rows: (best.length ? best : r.rows).slice(0, 2) });
    if (popular.length >= 4) break;
  }
  return {
    series, label: label(series), make: make(series), name: NAMES[series] || '', engines: (D.SE[series] || []).slice().sort(),
    count: rows, groups: Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([g, n]) => ({ g, name: D.GE[g] || g, n })), popular,
  };
}
for (const s of CANDIDATES) { const n = slice(s).rows; if (NAMES[s] && n - GENERIC >= MIN_SPECS) { ALLS.push(s); SCNT[s] = n; } }
const TOTAL = ALLS.reduce((n, s) => n + SCNT[s] - GENERIC, 0) + GENERIC; // each generic row counted once
const INDEX = { SE: D.SE, ALLS, SCNT, GE: D.GE, meta: D.meta };

module.exports = { INDEX, ALLS, TOTAL, NAMES, BRANDS, brandOf, make, label, slice, sliceJson, seo, meta: D.meta };
