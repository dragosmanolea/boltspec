// Tightening torques (ISTA data) – same filtering logic as the torque module.
// BoltSpec uses it for the few example values shown on each car page (for search engines and visitors without JavaScript).
const path = require('path');
const D = require('./dataset'); // same dataset as data.js (local-data/ when running locally)

const { S, GE = {}, SE, NAMES = {} } = D;
const nod = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ROWS = D.R.map((r) => ({
  g: r[0], sg: S[r[1]], p: S[r[2]], a: S[r[3]], th: S[r[4]],
  op: S[r[5]], v: S[r[6]], ser: r[7].map((i) => S[i]), eng: r[8].map((i) => S[i]),
  gen: r[11],
  blocks: (r[12] || []).map((b) => ({ s: b[0].map((i) => S[i]), e: b[1].map((i) => S[i]), n: (b[2] || []).map((i) => S[i]) })),
}));
ROWS.forEach((r) => { r.hay = nod([r.sg, r.p].join(' ')); });

const ALL_SERIES = [...new Set(ROWS.flatMap((r) => r.ser))].filter((s) => s !== 'W16').sort();

function rowMatch(r, series, engine) {
  if (r.blocks.length) { // v2 data: any validity block (alternative in ISTA) may match
    const se = SE[series] || [], sv = (D.SEV || {})[series] || {};
    return r.blocks.some((b) => {
      if (engine && b.n.includes(engine)) return false;
      if (b.s.length && !b.s.includes(series)) return false;
      if (!b.e.length) return true;
      if (engine) return b.e.includes(engine);
      if (b.s.length) return !b.e.every((x) => sv[x] && !se.includes(x));
      return b.e.some((x) => se.includes(x));
    });
  }
  if (r.ser.length && !r.ser.includes(series)) return false;
  if (!r.ser.length && !r.eng.length && !r.gen) return false;
  if (r.eng.length) {
    if (engine) { if (!r.eng.includes(engine)) return false; }
    else {
      const se = SE[series] || [];
      if (!r.ser.length && se.length && !r.eng.some((e) => se.includes(e))) return false;
      if (!r.ser.length && !se.length) return false;
    }
  }
  return true;
}

// Part categories → where to look in ISTA.
// rules: g = ISTA groups, sg = regex on the subgroup, p = regex on the part/subgroup. q = search for the torque module.
const CATS = [
  { id: 'brakes', name: 'Brakes (pads / discs / caliper)',
    rules: [{ g: ['34'], sg: /front brake|rear brake|brake caliper|^brakes?$/i }, { g: ['34'], p: /caliper|brake disc|guide screw|brake carrier|anchor plate/i }, { g: ['36'], p: /wheel bolt|wheel nut/i }], q: 'brake' },
  { id: 'shocks', name: 'Shock absorbers / springs',
    rules: [{ g: ['31', '33', '37'], sg: /spring strut|shock absorber|coil spring|^springs?$|air spring/i }, { g: ['31', '33'], p: /shock absorber|spring strut|support bearing|top mount/i }], q: 'shock absorber' },
  { id: 'antiroll', name: 'Anti-roll bar / link',
    rules: [{ g: ['31', '33'], p: /anti-?roll bar|stabili[sz]er/i }], q: 'anti-roll bar' },
  { id: 'arms', name: 'Control arms / ball joints / bushes',
    rules: [{ g: ['31', '33'], sg: /axle guide|axle strut|wishbone|control arm|trailing arm|tension strut/i }, { g: ['31', '33'], p: /wishbone|control arm|ball joint|tension strut|thrust rod|camber arm|trailing arm/i }], q: 'control arm' },
  { id: 'bearing', name: 'Wheel bearing / hub',
    rules: [{ g: ['31', '33'], p: /wheel bearing|drive flange|wheel hub|hub/i }, { g: ['36'], p: /wheel bolt/i }], q: 'wheel bearing' },
  { id: 'pspump', name: 'Power steering pump',
    rules: [{ g: ['32'], p: /power steering pump|pressure line|return line|oil reservoir/i }], q: 'power steering pump' },
  { id: 'steering', name: 'Steering (tie rod / track rod / rack)',
    rules: [{ g: ['32'], p: /track rod|tie rod|steering gear|steering rack|steering arm|drop arm|^rack/i }, { g: ['32'], sg: /steering arms?|drop arm|track rod/i }], q: 'track rod' },
  { id: 'sparkplugs', name: 'Spark plugs', rules: [{ p: /spark plug/i }], q: 'spark plug' },
  { id: 'coils', name: 'Ignition coils', rules: [{ p: /ignition coil/i }], q: 'ignition coil' },
  { id: 'drainplug', name: 'Oil drain plug / sump',
    rules: [{ g: ['11'], p: /oil drain plug|drain plug|oil sump|oil pan/i }], q: 'oil drain plug' },
  { id: 'oilfilter', name: 'Oil filter',
    rules: [{ g: ['11'], p: /oil filter (cap|cover|housing)|oil filter$/i }, { g: ['11'], p: /oil drain plug/i }], q: 'oil filter' },
  { id: 'waterpump', name: 'Water pump / thermostat',
    rules: [{ g: ['11', '17'], p: /coolant pump|water pump|thermostat/i }], q: 'coolant pump' },
  { id: 'belt', name: 'Belt / tensioner / pulleys',
    rules: [{ g: ['11', '12', '32', '64'], p: /belt|tensioner|idler|deflection pulley|vibration damper|belt pulley/i }], q: 'tensioner' },
  { id: 'timing', name: 'Timing (chain / kit)',
    rules: [{ g: ['11'], sg: /timing|camshaft/i, p: /chain|tensioner|sprocket|guide|camshaft/i }], q: 'chain tensioner' },
  { id: 'injector', name: 'Injectors', rules: [{ g: ['13'], p: /injector|rail|nozzle/i }], q: 'injector' },
  { id: 'alternator', name: 'Alternator', rules: [{ g: ['12'], p: /alternator|generator/i }], q: 'alternator' },
  { id: 'starter', name: 'Starter motor', rules: [{ g: ['12'], p: /starter/i }], q: 'starter' },
  { id: 'ac', name: 'A/C compressor', rules: [{ g: ['64'], p: /compressor|condenser|dryer/i }], q: 'compressor' },
  { id: 'turbo', name: 'Turbocharger', rules: [{ g: ['11'], p: /turbocharger|turbo/i }], q: 'turbocharger' },
  { id: 'egr', name: 'EGR valve', rules: [{ p: /exhaust gas recirculation|\begr\b/i }], q: 'EGR' },
  { id: 'radiator', name: 'Radiator / fan',
    rules: [{ g: ['17'], p: /radiator|fan|intercooler|charge air/i }], q: 'radiator' },
  { id: 'driveshaft', name: 'Drive shaft / prop shaft',
    rules: [{ g: ['26', '31', '33'], p: /output shaft|drive shaft|axle shaft|propeller shaft|universal joint|drive flange/i }], q: 'output shaft' },
  { id: 'exhaust', name: 'Exhaust (silencer / catalyst / DPF)',
    rules: [{ g: ['18'] }], q: 'exhaust' },
  { id: 'abs', name: 'ABS sensor', rules: [{ p: /pulse generator|wheel speed sensor|dsc sensor/i }], q: 'pulse generator' },
  { id: 'fuel', name: 'Fuel filter / pump',
    rules: [{ g: ['13', '16'], p: /fuel filter|fuel pump|high pressure pump|delivery unit/i }], q: 'fuel filter' },
  { id: 'head', name: 'Cylinder head / valve cover',
    rules: [{ g: ['11'], sg: /cylinder head/i }], q: 'cylinder head cover' },
  { id: 'clutch', name: 'Clutch / flywheel',
    rules: [{ g: ['21'] }, { g: ['11'], p: /flywheel/i }], q: 'clutch' },
  { id: 'mounts', name: 'Engine / gearbox mount',
    rules: [{ g: ['22'] }], q: 'engine mount' },
  { id: 'wheels', name: 'Wheels / wheel bolts', rules: [{ g: ['36'] }], q: 'wheel bolt' },
];

function ruleMatch(r, rule) {
  if (rule.g && !rule.g.includes(r.g)) return false;
  if (rule.sg && !rule.sg.test(r.sg)) return false;
  if (rule.p && !rule.p.test(r.p) && !rule.p.test(r.sg)) return false;
  return true;
}

function fmt(r) {
  return {
    group: r.g, groupName: GE[r.g] || r.g,
    sub: r.sg, part: r.p, value: r.v, thread: r.th || '',
    note: r.op && r.op !== r.v ? r.op : '',
    engines: r.eng,
  };
}

/** Torque specs for a part category (or free text) on a car. */
function lookup({ text, category, series, engine, limit = 40 }) {
  if (!series || !ALL_SERIES.includes(series)) return { error: 'series', series: ALL_SERIES.length };
  const cat = category ? CATS.find((c) => c.id === category) : null;
  const base = ROWS.filter((r) => rowMatch(r, series, engine || null));
  let rows = [];
  if (cat) rows = base.filter((r) => cat.rules.some((rule) => ruleMatch(r, rule)));
  else if (text) { const ts = nod(text).split(/\s+/).filter(Boolean); rows = base.filter((r) => ts.every((w) => r.hay.includes(w))); }
  // no duplicates (same part + value)
  const seen = new Set();
  rows = rows.filter((r) => { const k = [r.g, r.sg, r.p, r.v, r.th].join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  rows.sort((a, b) => a.g.localeCompare(b.g) || a.sg.localeCompare(b.sg));
  return {
    series, engine: engine || null, seriesName: NAMES[series] || '',
    category: cat ? { id: cat.id, name: cat.name, q: cat.q } : null,
    total: rows.length, rows: rows.slice(0, limit).map(fmt),
  };
}

module.exports = { lookup, CATS };
