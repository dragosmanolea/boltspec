// Classic cars (data book, 1980–1997): make and model pages for every make other than BMW / MINI / Rolls-Royce.
// Data: src/service-data.json → classic[makeSlug] = { n: name, m: { modelSlug: { n: name, v: [variants] } } }.
let SVC = {};
try { SVC = require('./service-data.json'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.error('BoltSpec: cannot read src/service-data.json – ' + e.message); }
const C = SVC.classic || {};
const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

// "1983–1997" from the variants' year strings
function span(vs) {
  const ys = vs.flatMap((v) => (v.y.match(/(19|20)\d\d/g) || []).map(Number));
  if (!ys.length) return '';
  const a = Math.min(...ys), b = Math.max(...ys);
  return a === b ? String(a) : `${a}–${b}`;
}
const MAKES = Object.entries(C).map(([slug, M]) => ({
  slug, name: M.n,
  models: Object.entries(M.m).map(([ms, f]) => ({ slug: ms, name: f.n, n: f.v.length, years: span(f.v) })).sort((a, b) => byName(a.name, b.name)),
})).sort((a, b) => byName(a.name, b.name));
const MAKE = Object.fromEntries(MAKES.map((m) => [m.slug, m]));
const SHEETS = MAKES.reduce((n, m) => n + m.models.reduce((k, x) => k + x.n, 0), 0);
const MODELS = MAKES.reduce((n, m) => n + m.models.length, 0);

const get = (make, model) => (C[make] && C[make].m[model]) || null;
const key = (make, model) => `c/${make}/${model}`;
// public summary for the page (no values): one row per engine variant
function summary(make, model) {
  const f = get(make, model);
  return f && { make: C[make].n, model: f.n, years: span(f.v), variants: f.v.map((v) => ({ m: v.m, y: v.y, t: v.t })) };
}
// the protected payload (encrypted per visitor like the BMW series slices); the watermark rides along unused
const memo = new Map();
function modelJson(make, model, mark) {
  const k = key(make, model);
  if (!memo.has(k)) { const f = get(make, model); memo.set(k, JSON.stringify({ n: f.n, make: C[make].n, H: f.v, w: '' })); }
  return memo.get(k).replace(/"w":""\}$/, `"w":${JSON.stringify(mark)}}`);
}
module.exports = { MAKES, MAKE, SHEETS, MODELS, get, key, summary, modelJson };
