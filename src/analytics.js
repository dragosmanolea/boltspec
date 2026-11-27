// Cookieless first-party analytics.
// Visitors are counted with a hash of (IP, user agent, day) keyed by a salt that rotates daily,
// so nobody can be followed across days and no IP or cookie is stored. Bots are dropped.
const crypto = require('crypto');
const { types } = require('pg');
const db = require('./db');

types.setTypeParser(1082, (v) => v); // DATE as 'YYYY-MM-DD'
const SCHEMA = `
CREATE TABLE IF NOT EXISTS ev(id BIGSERIAL PRIMARY KEY, at BIGINT NOT NULL, day DATE NOT NULL, vh TEXT NOT NULL,
  name TEXT NOT NULL, path TEXT, prop TEXT, num INT, src TEXT, medium TEXT, campaign TEXT, dev TEXT, cc TEXT);
CREATE INDEX IF NOT EXISTS ev_day_name ON ev(day, name);
CREATE INDEX IF NOT EXISTS ev_at ON ev(at);
`;

const NAMES = new Set(['pv', 'car', 'engine', 'search', 'coffee', 'newsletter', 'copy', 'limit']);
const BOT = /bot|crawl|spider|slurp|headless|preview|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|axios|node-fetch|go-http|java\//i;
const KEEP_DAYS = 400;

let salt = { day: '', key: null };
const daySalt = (secret, day) => {
  if (salt.day !== day) salt = { day, key: crypto.createHmac('sha256', secret).update('analytics|' + day).digest() };
  return salt.key;
};

// Friendly names for common referrers; anything else keeps its host name.
const SOURCES = [
  [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\./, 'Yahoo'],
  [/(^|\.)yandex\./, 'Yandex'], [/(^|\.)ecosia\.org$/, 'Ecosia'], [/(^|\.)facebook\.com$|^fb\.|^l\.facebook/, 'Facebook'],
  [/instagram\.com$/, 'Instagram'], [/(^|\.)reddit\.com$/, 'Reddit'], [/youtube\.com$|youtu\.be$/, 'YouTube'],
  [/(^|\.)t\.co$|twitter\.com$|x\.com$/, 'X / Twitter'], [/linkedin\.com$|lnkd\.in$/, 'LinkedIn'], [/tiktok\.com$/, 'TikTok'],
  [/chatgpt\.com$|openai\.com$/, 'ChatGPT'], [/perplexity\.ai$/, 'Perplexity'], [/claude\.ai$/, 'Claude'],
  [/bimmerpost\.com$|bimmerfest\.com$|e90post\.com$|f30post\.com$|5post\.com$/, 'BMW forums'],
];
function sourceOf(ref, ownHost, utm) {
  if (utm) return utm.slice(0, 60);
  let host = '';
  try { host = new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch { return '(direct)'; }
  if (!host) return '(direct)';
  if (host === ownHost) return null; // navigation inside the site, not a new visit source
  for (const [re, name] of SOURCES) if (re.test(host)) return name;
  return host.slice(0, 80);
}

const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
const COLS = ['at', 'day', 'vh', 'name', 'path', 'prop', 'num', 'src', 'medium', 'campaign', 'dev', 'cc'];
const evLog = db.batcher('ev', COLS);
db.flushers.push(evLog.flush);

// Records one event from the beacon. Returns false when it was ignored.
function record({ secret, ip, ua, cc, ownHost, body }) {
  if (!body || !NAMES.has(body.n) || !ua || BOT.test(ua)) return false;
  const path = clip(body.p, 200) || '/';
  if (path.startsWith('/admin')) return false;
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const vh = crypto.createHmac('sha256', daySalt(secret, day)).update(ip + '|' + ua).digest('base64url').slice(0, 16);
  const w = Number(body.w) || 0;
  const dev = !w ? null : w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
  const isPv = body.n === 'pv';
  const prop = ['car', 'engine'].includes(body.n) ? clip(String(body.v || '').toLowerCase(), 80) : body.n === 'search' ? clip(String(body.v || '').trim().toLowerCase(), 80) : clip(body.v, 80);
  if (body.n === 'search' && !prop) return false;
  evLog.push([now, day, vh, body.n, path, prop, Number.isFinite(+body.c) ? Math.trunc(+body.c) : null,
    isPv ? sourceOf(body.r, ownHost, clip(body.us, 60)) : null, isPv ? clip(body.um, 60) : null, isPv ? clip(body.uc, 80) : null,
    dev, /^[A-Z]{2}$/.test(cc || '') ? cc : null]);
  return true;
}

// Report for the admin dashboard over the last `days` days.
async function report(days) {
  days = Math.min(Math.max(Number(days) || 30, 1), KEEP_DAYS);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const from = iso(Date.now() - (days - 1) * 864e5), prevFrom = iso(Date.now() - (2 * days - 1) * 864e5);
  const F = (n) => `COUNT(*) FILTER (WHERE name='${n}')::int`;
  const totalsFor = (a, b) => db.one(`SELECT (SELECT COUNT(*)::int FROM (SELECT DISTINCT day, vh FROM ev WHERE day>=$1 AND day<$2) d) visitors,
      ${F('pv')} pageviews, ${F('car')} cars, ${F('search')} searches, ${F('coffee')} coffee, ${F('newsletter')} newsletter,
      ${F('copy')} copies, ${F('limit')} limited FROM ev WHERE day>=$1 AND day<$2`, [a, b]);
  const top = (name, col, limit = 15) => db.all(`SELECT ${col} k, COUNT(*)::int n, COUNT(DISTINCT (day, vh))::int v FROM ev
      WHERE day>=$1 AND name=$2 AND ${col} IS NOT NULL GROUP BY ${col} ORDER BY n DESC LIMIT $3`, [from, name, limit]);
  const [totals, previous, live, daily, pages, cars, engines, searches, noResults, sources, campaigns, devices, countries, conversions] = await Promise.all([
    totalsFor(from, '9999-12-31'), totalsFor(prevFrom, from),
    db.one('SELECT COUNT(DISTINCT vh)::int n FROM ev WHERE at>$1', [Date.now() - 5 * 60e3]).then((r) => r.n),
    db.all(`SELECT day, COUNT(DISTINCT vh)::int visitors, ${F('pv')} pageviews, ${F('car')} cars,
      COUNT(*) FILTER (WHERE name IN ('coffee','newsletter'))::int conversions FROM ev WHERE day>=$1 GROUP BY day ORDER BY day`, [from]),
    top('pv', 'path', 20), top('car', 'prop', 20), top('engine', 'prop', 20),
    db.all(`SELECT prop k, COUNT(*)::int n, ROUND(AVG(num))::int avg FROM ev WHERE day>=$1 AND name='search' GROUP BY prop ORDER BY n DESC LIMIT 25`, [from]),
    db.all(`SELECT prop k, COUNT(*)::int n, MAX(path) path FROM ev WHERE day>=$1 AND name='search' AND num=0 GROUP BY prop ORDER BY n DESC LIMIT 25`, [from]),
    top('pv', 'src', 20),
    db.all(`SELECT src||' / '||COALESCE(medium,'-')||' / '||campaign k, COUNT(*)::int n, COUNT(DISTINCT (day, vh))::int v FROM ev
      WHERE day>=$1 AND name='pv' AND campaign<>'' GROUP BY 1 ORDER BY n DESC LIMIT 20`, [from]),
    top('pv', 'dev', 5), top('pv', 'cc', 15),
    // A conversion is credited to the source of that visitor's first page view of the day.
    db.all(`WITH first AS (SELECT DISTINCT ON (day, vh) day, vh, src FROM ev WHERE day>=$1 AND name='pv' ORDER BY day, vh, id),
      per AS (SELECT src, COUNT(*)::int visitors FROM first GROUP BY src)
      SELECT COALESCE(f.src,'(unknown)') k, COUNT(*) FILTER (WHERE c.name='coffee')::int coffee,
        COUNT(*) FILTER (WHERE c.name='newsletter')::int newsletter, MAX(per.visitors) visitors
      FROM ev c LEFT JOIN first f ON f.day=c.day AND f.vh=c.vh LEFT JOIN per ON per.src=f.src
      WHERE c.day>=$1 AND c.name IN ('coffee','newsletter') GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 20`, [from]),
  ]);
  return { days, from, totals, previous, live, daily, pages, cars, engines, searches, noResults, sources, campaigns, devices, countries, conversions };
}

const housekeeping = () => db.run('DELETE FROM ev WHERE day<$1', [new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10)]).catch(() => {});
setInterval(housekeeping, 6 * 3600e3).unref();

module.exports = { SCHEMA, record, report, housekeeping, sourceOf };
