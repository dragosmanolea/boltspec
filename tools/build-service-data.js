// Builds src/service-data.json (the "Service data" card) from the extracted data-book sheets.
// Usage: node tools/build-service-data.js <haynes-data.json> [--makes=BMW,MINI]
// Only the makes listed are written (default BMW); the structure is per make → per series, so more
// makes can be switched on later without code changes, once they have their own series pages.
const fs = require('fs');
const path = require('path');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-service-data.js <haynes-data.json> [--makes=BMW]'); process.exit(1); }
const makesArg = (process.argv.find((a) => a.startsWith('--makes=')) || '--makes=BMW').slice(8).split(',').map((s) => s.trim().toUpperCase());
// --classic: every other make goes on its own make/model pages (out.classic), grouped by tools/classic-families.js
const CLASSIC = process.argv.includes('--classic');
const FAM = require('./classic-families');
const IN = JSON.parse(fs.readFileSync(src, 'utf8'));

// series a sheet belongs to (BoltSpec page key). Chassis code in the model name, otherwise by model + years.
const BMW_SERIES = (x) => {
  const m = x.model.match(/\b(E\d\d)\b/); if (m) return m[1];
  if (/^Z1\b/.test(x.model)) return 'E30';           // Z1 is built on E30 running gear
  if (/^Z3\b/.test(x.model)) return 'E36';           // Z3 = E36/7
  if (/^M3\b/.test(x.model)) return /19(8\d|90|91)/.test(x.years) ? 'E30' : 'E36';
  return null;
};
const SERIES = { BMW: BMW_SERIES };
const ENGINE = { BMW: (t) => { const m = (t || '').match(/\b([MSN]\d{2})\b/); return m ? m[1] : ''; } };

const SEC = [['engine', 'Engine & cooling'], ['fuel', 'Fuel system'], ['ignition', 'Ignition'], ['electrical', 'Electrical'], ['running_gear', 'Brakes, tyres & alignment'], ['torque', 'Torque settings'], ['capacities', 'Capacities']];
const DROP = /^(HC|CO2|O2) @|V = Vacuum|^Total ignition advance - º Crankshaft @ rpm$/;
const PRE = [[/^Front suspension \/ wheel alignment - /, 'Front · '], [/^Rear suspension \/ wheel alignment - /, 'Rear · '], [/^Carburettor \/ fuel injection - /, 'Carb / injection · '], [/^Total ignition advance - /, 'Ignition advance · '], [/^Brakes - (Front|Rear) \(min\. friction material thickness\)/, 'Brake pads $1 – min. thickness'], [/^Tyres - Saloon \(Size\)$/, 'Tyre size'], [/^Tyres - Estate \/ Van \(Size\)$/, 'Tyre size – Estate / Van'], [/^Tyres - Pressure - front \/ rear - Saloon/, 'Tyre pressure front / rear'], [/^Tyres - Pressure - front \/ rear - Estate \/ Van/, 'Tyre pressure front / rear – Estate / Van'], [/^Carburettor \/ fuel injection$/, 'Carb / injection make'], [/^Spark plugs$/, 'Spark plug make'], [/^Ignition coil$/, 'Ignition coil make'], [/^Distributor$/, 'Distributor make']];
const label = (k) => PRE.reduce((t, [a, b]) => t.replace(a, b), k).replace(/ - see page VI/g, '').replace(/\[static\b(?!\])/g, '[static]').replace(/Tmnl/g, 'terminal')
  .replace(/º Crankshaft/g, '°crank').replace(/º/g, '°').replace(/ - /g, ' · ').replace(/\s+/g, ' ').trim();
// "Stage 1 (Nm)" → label "Stage 1" + unit "Nm" (shown after the value). Kept in the label where the unit covers only part of it.
const UNIT = { Nm: 'Nm', litres: 'L', bar: 'bar', mm: 'mm', '°C': '°C', rpm: 'rpm', '%': '%', ohms: 'Ω', V: 'V', mbar: 'mbar', ppm: 'ppm', RON: 'RON', 'cm³': 'cm³', A: 'A' };
function splitUnit(l) {
  const m = l.match(/^(.*?) \(([^()]+)\)$/);
  if (!m || !UNIT[m[2]] || /ratio|number of/i.test(m[1])) return [l, ''];
  return [m[1], UNIT[m[2]]];
}
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fromSup = (t) => Number([...t].map((c) => SUPS.indexOf(c)).join(''));
// "60⁴" → value "60", footnotes [4]
function splitFn(v) {
  const fns = [...v.matchAll(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g)].map((m) => fromSup(m[0]));
  return [v.replace(/\s*[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, '').trim(), [...new Set(fns)]];
}
// a number, a range or a tolerance: "60", "30 to 32", "1.0±0.5", "+3.5±1.0", "[3.5]"
const NUM = '[≤≥]?[-+]?\\d+(?:\\.\\d+)?(?:\\s?(?:to|-)\\s?\\d+(?:\\.\\d+)?)?(?:±\\d+(?:\\.\\d+)?)?';
const PURE = new RegExp(`^${NUM}(?:\\s?\\[${NUM}\\])?$|^\\[${NUM}\\]$|^${NUM}(?:\\s?/\\s?${NUM})+$`);
const CODED = new RegExp(`^(${NUM})\\s+(?!(?:to|or)\\b)([A-Za-z][A-Za-z /]{0,24})$`); // "30 N", "30 to 32 WSM", "29 oiled", "750±50 N/A"
const row = (l, v) => {
  const [lb0, u0] = splitUnit(label(l)); let [val, fns] = splitFn(value(v)); let lb = lb0, u = '';
  if (u0) {
    let m;
    if (val.includes(u0) || new RegExp(`\\b${u0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(val)) u = ''; // the value already names its unit ("98[E 95 RON]")
    else if (/°/.test(val) || !/\d/.test(val) || /^\d+: ?Hyd/i.test(val)) u = ''; // angles, codes (WSM), hydraulic: no unit at all
    else if (PURE.test(val)) u = u0; // plain number: unit shown after it
    else if ((m = val.match(CODED))) val = `${m[1]} ${u0} ${m[2]}`; // "30 Nm N"
    else lb = `${lb0} (${u0})`; // free text: the unit stays in the label
  }
  const r = [lb, val, u]; if (fns.length) r.push(fns); return r; };
// key values a mechanic looks for first
function keySpecs(d) {
  const get = (sec, re) => { const s = d.find((x) => x[0] === sec); return s ? s[1].filter((r) => re.test(r[0])) : []; };
  const one = (sec, re) => get(sec, re)[0];
  const K = [], fnsOf = (rs) => [...new Set(rs.flatMap((r) => r[3] || []))];
  const push = (l, rs, v, u) => { if (!v) return; const k = [l, v, u || '']; const f = fnsOf(rs); if (f.length) k.push(f); K.push(k); };
  const head = get('Torque settings', /^Cylinder head · stage/i).filter((r) => r[1] && r[1] !== '–');
  push('Cylinder head', head, head.map((r) => r[1] + (r[2] ? ' ' + r[2] : '')).join(' → '));
  const wn = one('Torque settings', /^Wheel nuts/i); if (wn) push('Wheel nuts / bolts', [wn], wn[1], wn[2]);
  const sp = one('Torque settings', /^Spark plugs$/i); if (sp) push('Spark plugs (torque)', [sp], sp[1], sp[2]);
  const pt = one('Ignition', /^Spark plugs · Type/i), pg = one('Ignition', /^Spark plugs · Electrode gap/i);
  const plain = (x) => x && !/[:·]|from/i.test(x[1]);
  if (pt && plain(pt) && (!pg || plain(pg))) push('Spark plugs', [pt, pg].filter(Boolean), pt[1] + (pg && pg[1] !== '–' ? ` · gap ${pg[1]}${pg[2] ? ' ' + pg[2] : ''}` : ''));
  else { if (pt) push('Spark plugs', [pt], pt[1]); if (pg && pg[1] !== '–') push('Plug gap', [pg], pg[1], pg[2]); }
  const oil = one('Capacities', /^Engine oil/i); if (oil) push('Engine oil & filter', [oil], oil[1], oil[2]);
  const cool = one('Capacities', /^Cooling system/i); if (cool) push('Coolant', [cool], cool[1], cool[2]);
  const vi = one('Engine & cooling', /^Valve clearance · inlet/i), ve = one('Engine & cooling', /^Valve clearance · exhaust/i);
  if (vi) { const hyd = /hyd/i.test(vi[1]); push('Valve clearance in / ex', [vi, ve].filter(Boolean), hyd ? 'Hydraulic' : `${vi[1]} / ${ve ? ve[1] : '–'}`, hyd ? '' : 'mm'); }
  const tp = one('Brakes, tyres & alignment', /^Tyre pressure front \/ rear$/i); if (tp) push('Tyre pressure F / R', [tp], tp[1], tp[2]);
  const idle = one('Fuel system', /^Idle speed/i); if (idle) push('Idle speed', [idle], idle[1], idle[2]);
  const fo = one('Engine & cooling', /^Firing order/i); if (fo) push('Firing order', [fo], fo[1]);
  return K;
}
function engCode(t) {
  const w = t.split(/[\s,]+/).map((x) => x.replace(/[.:;]+$/, ''));
  if (!w[0] || /^(SOHC|DOHC|OHV|OHC|Type|N\/A|–)$/i.test(w[0]) || /^\d+(\.\d+)?(kW|cc|cm³)?$/i.test(w[0])) return '';
  if (/^[A-Z]{1,2}$/.test(w[0]) && w[1] && /^\d{3,}$/.test(w[1])) return w[0] + ' ' + w[1]; // "AR 33501"
  return w[0];
}
const SUPNUM = /^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*(.*)$/;
const value = (v) => {
  let t = v.replace(/©/g, 'on').replace(/(^|\s)_(?=\s|$)/g, '$1–').replace(/\s+/g, ' ').trim();
  // dates in the data book: "X. 4.90 on: Y" → "X · from 4/90: Y", "1988 on:" → "from 1988:"
  t = t.replace(/(\S)\.\s+(?=\d{1,2}\.\d{2} on\b)/g, '$1 · ').replace(/\b(\d{1,2})\.(\d{2}) on\b/g, 'from $1/$2')
    .replace(/(\S)\.\s+(?=(?:19)?[89]\d on\b)/g, '$1 · ').replace(/\b(19[89]\d) on\b/g, 'from $1').replace(/(^|[\s(·])([89]\d) on\b/g, "$1from '$2");
  // unbalanced bracket from the PDF: "700 to 850 [750 to 900)"
  if ((t.match(/\[/g) || []).length > (t.match(/\]/g) || []).length) t = t.replace(/\)(?=[^\]]*$)/, ']');
  return t.replace(/^from/, 'From');
};
const years = (y) => y.replace(/\s*to\s*/i, '–').replace(/\s*-\s*/, '–');
const name = (s) => s.replace(/\s+/g, ' ').replace(/\s*&\s*/g, ' & ').trim();

const out = { meta: { built: new Date().toISOString().slice(0, 10), makes: [], sheets: 0 } };
const skipped = [];
for (const x of IN.sheets || IN) {
  const mk = x.make;
  const classic = CLASSIC && !SERIES[mk] && FAM.MAKES[mk];
  if (!classic && (!makesArg.includes(mk) || !SERIES[mk])) continue;
  const s = classic ? null : SERIES[mk](x);
  if (!classic && !s) { skipped.push(x.model + ' ' + x.years); continue; }
  const t = (x.sections.engine || {}).Type || '';
  const d = [];
  for (const [k, title] of SEC) {
    // a few sheets have the value inside the label column: "Cylinder head - stage 1 (Nm 50)"
    const fixLbl = ([l, v]) => { const m = !v && l.match(/^(.*) \((Nm|litres|bar|mm|rpm|ºC|%) ([^)]+)\)$/); return m ? [`${m[1]} (${m[2]})`, m[3]] : [l, v]; };
    const rows = Object.entries(x.sections[k] || {}).map(fixLbl).filter(([l, v]) => v && v !== 'N/A' && !DROP.test(l)).map(([l, v]) => row(l, v));
    if (rows.length) d.push([title, rows]);
  }
  if (!d.length) continue;
  // footnotes: referenced ones go next to their value (n), the rest stay as general notes (x)
  const used = new Set(d.flatMap((s) => s[1].flatMap((r) => r[3] || [])));
  const N = {}, X = [];
  for (const raw of (x.sections.notes || []).filter((n) => n && n !== '_')) {
    const m = raw.match(SUPNUM), txt = value(m ? m[2] : raw);
    if (m && used.has(fromSup(m[1]))) N[fromSup(m[1])] = txt; else if (txt) X.push(txt);
  }
  let model = name(x.model).replace(/(CAT|\)|Evolution|EFi)1$/, '$1');
  if (mk === 'BMW') model = model.replace(/\s*\(?E\d\d\)?$/, '').trim();
  const tt = value(t);
  const cap = ((d.find((s) => s[0] === 'Engine & cooling') || [, []])[1].find((r) => /^Capacity/.test(r[0])) || [])[1] || '';
  const cc = Number((cap.match(/^\d{3,4}/) || [])[0]);
  const v = { m: model, y: years(x.years), e: classic ? '' : ENGINE[mk](t), t: tt, c: (mk === 'BMW' && !engCode(tt) && ENGINE[mk](t)) || engCode(tt), kw: Number((tt.match(/(\d{2,3})\s?kW/) || [])[1]) || 0, l: cc ? (Math.round(cc / 100) / 10).toFixed(1) : '', k: keySpecs(d), d };
  for (const sec of d) for (const r of sec[1]) if (r[3]) { r[3] = r[3].filter((n) => N[n]); if (!r[3].length) r.length = 3; }
  for (const k of v.k) if (k[3]) { k[3] = k[3].filter((n) => N[n]); if (!k[3].length) k.length = 3; }
  if (Object.keys(N).length) v.n = N;
  if (X.length) v.x = X;
  if (classic) {
    const mn = FAM.MAKES[mk], ms = FAM.makeSlug(mn), fn = FAM.family(mk, model), fs_ = FAM.slug(fn);
    const C = (out.classic = out.classic || {});
    const M = (C[ms] = C[ms] || { n: mn, m: {} });
    (M.m[fs_] = M.m[fs_] || { n: fn, v: [] }).v.push(v);
    out.meta.classic = (out.meta.classic || 0) + 1;
    continue;
  }
  ((out[mk] = out[mk] || {})[s] = out[mk][s] || []).push(v);
  out.meta.sheets++;
  if (!out.meta.makes.includes(mk)) out.meta.makes.push(mk);
}
for (const mk of out.meta.makes) for (const s of Object.keys(out[mk])) out[mk][s].sort((a, b) => a.y.localeCompare(b.y) || a.m.localeCompare(b.m, 'en', { numeric: true }));
const byYear = (a, b) => a.y.localeCompare(b.y) || a.m.localeCompare(b.m, 'en', { numeric: true });
for (const M of Object.values(out.classic || {})) for (const f of Object.values(M.m)) f.v.sort(byYear);
const dst = path.join(__dirname, '..', 'src', 'service-data.json');
fs.writeFileSync(dst, JSON.stringify(out));
console.log(`service-data.json: ${out.meta.sheets} sheets, makes ${out.meta.makes.join(', ')}; series:`, Object.fromEntries(out.meta.makes.flatMap((m) => Object.entries(out[m]).map(([s, v]) => [s, v.length]))));
if (skipped.length) console.log('no series for:', skipped);
if (out.classic) { const C = out.classic; console.log(`classic: ${out.meta.classic} sheets, ${Object.keys(C).length} makes, ${Object.values(C).reduce((n, M) => n + Object.keys(M.m).length, 0)} model pages`); for (const [k, M] of Object.entries(C)) console.log(' ', k, Object.entries(M.m).map(([s, f]) => s + ':' + f.v.length).join(' ')); }
