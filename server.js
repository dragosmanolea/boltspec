// BoltSpec – tightening torques and service data for BMW, MINI and Rolls-Royce.
// One process: pages, the protected data endpoint, newsletter and a small admin area. Storage: PostgreSQL (DATABASE_URL).
// Hosting without Docker (cPanel/Passenger): load .env next to server.js. Never overrides variables already set.
try { process.loadEnvFile(require('path').join(__dirname, '.env')); } catch { /* no .env file */ }
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const compression = require('compression');
const { minify } = require('terser');
const data = require('./src/data');
const classic = require('./src/classic');
const svc = require('./public/assets/svcdata.js'); // same code renders the variant rows on the server and in the browser
const db = require('./src/db');
const analytics = require('./src/analytics');
const mail = require('./src/mail');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString('hex'); // without SECRET, tokens reset on every restart
const BMC = (process.env.BMC_HANDLE || '').trim();
const CONTACT = (process.env.CONTACT_EMAIL || '').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LIMIT_HOUR = Number(process.env.CARS_PER_HOUR || 30); // distinct cars one visitor can open per hour
const LIMIT_DAY = Number(process.env.CARS_PER_DAY || 120);
const VIEWS = path.join(__dirname, 'views');
const ASSETS = path.join(__dirname, 'public', 'assets');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
const base = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const secure = /^https:/.test(PUBLIC_URL);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest();
// IPv6 visitors are grouped per /64 network (one household or phone)
const ipKey = (req) => { const ip = req.ip || ''; return ip.includes(':') && !ip.startsWith('::ffff:') ? ip.split(':').slice(0, 4).join(':') : ip.replace(/^::ffff:/, ''); };

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  });
  if (secure) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
});
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use(compression());
app.use(express.json({ limit: '200kb' }));

// ---------- client code: minified once at startup ----------
// cache-busting version: every script, stylesheet and icon in /assets plus the inlined loaders, so any change reaches browsers
const VERSION = (() => { const h = crypto.createHash('sha1'); for (const f of fs.readdirSync(ASSETS).filter((f) => /\.(js|css|svg)$/.test(f)).sort()) h.update(f).update(fs.readFileSync(path.join(ASSETS, f))); for (const f of ['loader.js', 'classic-loader.js']) h.update(fs.readFileSync(path.join(VIEWS, f))); return h.digest('hex').slice(0, 10); })();
const built = {};
async function build() {
  // the module's functions are called from inline onclick handlers, so top-level names stay; everything inside is mangled
  built.app = (await minify(fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8'), { compress: { passes: 2 }, mangle: true, format: { comments: false } })).code;
  // the loader is fully mangled; it is inlined in each car page with the public car index
  const loader = fs.readFileSync(path.join(VIEWS, 'loader.js'), 'utf8').replace('__INDEX__', json(data.INDEX));
  built.loader = (await minify(loader, { compress: { passes: 2 }, mangle: { toplevel: true }, toplevel: true, format: { comments: false } })).code;
  built.svc = (await minify(fs.readFileSync(path.join(ASSETS, 'svcdata.js'), 'utf8'), { compress: { passes: 2 }, mangle: true, format: { comments: false } })).code;
  built.cloader = (await minify(fs.readFileSync(path.join(VIEWS, 'classic-loader.js'), 'utf8'), { compress: { passes: 2 }, mangle: { toplevel: true }, toplevel: true, format: { comments: false } })).code;
}
app.get('/assets/svcdata.js', (req, res) => { res.type('application/javascript').set('Cache-Control', 'public, max-age=31536000, immutable').send(built.svc); });
app.get('/assets/app.js', (req, res) => { res.type('application/javascript').set('Cache-Control', 'public, max-age=31536000, immutable').send(built.app); });
app.use('/assets', express.static(ASSETS, { maxAge: '1h', setHeaders: (res, f) => { if (/\.woff2$/.test(f)) res.set('Cache-Control', 'public, max-age=2592000, immutable'); } }));

// ---------- visitor id (anti-abuse; not used for tracking) ----------
function visitor(req, res) {
  const m = /(?:^|;\s*)bs_v=([A-Za-z0-9_-]{16,40})/.exec(req.headers.cookie || '');
  if (m) return m[1];
  const v = crypto.randomBytes(12).toString('base64url');
  res.append('Set-Cookie', `bs_v=${v}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
  return v;
}
// A car page carries a short-lived token bound to the car, the visitor and their network. The data endpoint needs it.
const TOKEN_MS = 15 * 60e3;
function issueToken(series, vid, ip) {
  const p = Buffer.from(JSON.stringify({ s: series, v: vid, i: crypto.createHash('sha256').update(ip).digest('base64url').slice(0, 12), e: Date.now() + TOKEN_MS, n: crypto.randomBytes(6).toString('base64url') })).toString('base64url');
  return p + '.' + hmac(p).toString('base64url').slice(0, 32);
}
function readToken(t) {
  const [p, sig] = String(t || '').split('.');
  const want = hmac(p || '').toString('base64url').slice(0, 32);
  if (!p || !sig || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.e > Date.now() ? o : null; } catch { return null; }
}
// half of the decryption key is derived from the token (and baked into the page's loader), half comes with the response
const keyA = (token) => hmac('ka|' + token).toString('base64url').slice(0, 22);

// ---------- rate limits (in memory) ----------
const seen = new Map(); // key -> { hour: Map(series -> time), day: Set, dayStart }
function allowCar(key, series) {
  const now = Date.now();
  let e = seen.get(key);
  if (!e || now - e.dayStart > 864e5) { e = { hour: new Map(), day: new Set(), dayStart: now }; seen.set(key, e); }
  for (const [s, t] of e.hour) if (now - t > 3600e3) e.hour.delete(s);
  if (e.hour.has(series)) return true; // the same car again: free
  if (e.hour.size >= LIMIT_HOUR || (!e.day.has(series) && e.day.size >= LIMIT_DAY)) return false;
  e.hour.set(series, now); e.day.add(series);
  return true;
}
const buckets = new Map();
const limited = (key, max, ms) => { const now = Date.now(); const b = buckets.get(key); if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + ms }); return false; } b.n++; return b.n > max; };
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); for (const [k, e] of seen) if (now - e.dayStart > 864e5) seen.delete(k); }, 10 * 60e3).unref();

// ---------- the protected data endpoint ----------
app.get('/api/v1/d/:series', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const series = String(req.params.series || '').toUpperCase();
  const tok = readToken(req.get('x-bs-t'));
  const vid = (/(?:^|;\s*)bs_v=([A-Za-z0-9_-]{16,40})/.exec(req.headers.cookie || '') || [])[1];
  const ip = ipKey(req);
  const site = req.get('sec-fetch-site');
  // only the page's own loader gets the data: same site, valid token for this car, same visitor and network
  if ((site && site !== 'same-origin') || !tok || tok.s !== series || !vid || tok.v !== vid || tok.i !== crypto.createHash('sha256').update(ip).digest('base64url').slice(0, 12)) return res.status(403).json({ error: 'forbidden' });
  if (!data.ALLS.includes(series)) return res.status(404).json({ error: 'series' });
  if (limited('d:' + ip, 40, 60e3) || !allowCar('ip:' + ip, series) || !allowCar('v:' + vid, series)) return res.status(429).json({ error: 'rate' });
  // watermark: an unused string in the data that identifies this visitor; logged so a copy can be traced back
  const mark = 'bs' + hmac(`wm|${vid}|${ip}|${new Date().toISOString().slice(0, 10)}`).toString('base64url').slice(0, 10);
  db.logIssue(mark, vid, ip, series);
  sendSealed(req, res, data.sliceJson(series, mark));
});
// gzip + AES-256-GCM; half of the key comes from the page token, half with this response
function sendSealed(req, res, text) {
  const plain = zlib.gzipSync(Buffer.from(text), { level: 6 });
  const kb = crypto.randomBytes(16).toString('base64url');
  const key = crypto.createHash('sha256').update(`${keyA(req.get('x-bs-t'))}.${kb}.${req.get('x-bs-t')}`).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([iv, c.update(plain), c.final(), c.getAuthTag()]);
  res.set({ 'Content-Type': 'application/octet-stream', 'X-BS-K': kb, 'Access-Control-Expose-Headers': 'X-BS-K' }).send(body);
}
// classic model data: same checks, limits and watermark as the BMW series slices
app.get('/api/v1/c/:make/:model', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const make = String(req.params.make || '').toLowerCase(), model = String(req.params.model || '').toLowerCase();
  const car = classic.key(make, model);
  const tok = readToken(req.get('x-bs-t'));
  const vid = (/(?:^|;\s*)bs_v=([A-Za-z0-9_-]{16,40})/.exec(req.headers.cookie || '') || [])[1];
  const ip = ipKey(req);
  const site = req.get('sec-fetch-site');
  if ((site && site !== 'same-origin') || !tok || tok.s !== car || !vid || tok.v !== vid || tok.i !== crypto.createHash('sha256').update(ip).digest('base64url').slice(0, 12)) return res.status(403).json({ error: 'forbidden' });
  if (!classic.get(make, model)) return res.status(404).json({ error: 'model' });
  if (limited('d:' + ip, 40, 60e3) || !allowCar('ip:' + ip, car) || !allowCar('v:' + vid, car)) return res.status(429).json({ error: 'rate' });
  const mark = 'bs' + hmac(`wm|${vid}|${ip}|${new Date().toISOString().slice(0, 10)}`).toString('base64url').slice(0, 10);
  db.logIssue(mark, vid, ip, car);
  sendSealed(req, res, classic.modelJson(make, model, mark));
});

// ---------- pages ----------
const tpl = {};
for (const f of ['app', 'home', 'about', 'msg', 'admin', 'analytics', 'classic']) tpl[f] = fs.readFileSync(path.join(VIEWS, f + '.html'), 'utf8');
// Search engine verification tags (Google Search Console, Bing Webmaster Tools), set in .env
const VERIFY = [['google-site-verification', process.env.GSC_VERIFY], ['msvalidate.01', process.env.BING_VERIFY]]
  .filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${esc(v)}">`).join('');
const fill = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)).replace('</head>', VERIFY + '</head>');
const bsCfg = (extra = {}) => json({ bmc: BMC, contact: CONTACT, v: VERSION, ...extra });
const htmlHeaders = (res) => res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });

app.get('/', (req, res) => {
  visitor(req, res);
  const groups = data.BRANDS.map(([name, f]) => ({ name, list: data.ALLS.filter(f) })).filter((g) => g.list.length);
  const cars = groups.map((g) => `<section class="bs-brand"><h3>${esc(g.name)}</h3><ul class="bs-cars">${g.list.map((s) => `<li><a href="/${s.toLowerCase()}/" data-q="${esc((s + ' ' + data.label(s)).toLowerCase())}"><b class="mono">${esc(s)}</b><span>${esc(data.label(s).replace(/^(BMW|MINI|Rolls-Royce) \S+ ?/, ''))}</span></a></li>`).join('')}</ul></section>`).join('');
  const old = classic.MAKES.length ? `<section class="bs-brand bs-classic" id="classic"><h3>Classic cars · 1980–1997</h3><p class="bs-classic__lead">Engine, ignition, tyre and alignment data, torque settings and capacities for ${classic.MODELS} models from ${classic.MAKES.length} makes.</p><ul class="bs-cars">${classic.MAKES.map((m) => `<li><a href="/${m.slug}/" data-q="${esc((m.name + ' ' + m.models.map((x) => x.name).join(' ')).toLowerCase())}"><b>${esc(m.name)}</b><span>${m.models.length} model${m.models.length === 1 ? '' : 's'}</span></a></li>`).join('')}</ul></section>` : '';
  htmlHeaders(res).send(fill(tpl.home, {
    V: VERSION, BS: bsCfg(), CANON: base(req) + '/', CARS: cars + old, NCARS: data.ALLS.length, CLASSIC: classic.MODELS ? ` Plus service data for ${classic.MODELS} classic models from ${classic.MAKES.length} other makes (1980–1997).` : '',
    NSPECS: data.TOTAL.toLocaleString('en-GB'),
  }));
});
app.get('/about/', (req, res) => { htmlHeaders(res).send(fill(tpl.about, { V: VERSION, BS: bsCfg(), CANON: base(req) + '/about/', CONTACT: CONTACT ? `<a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>` : 'the contact address in the footer', SRC: esc(data.meta.src) })); });
app.get('/about', (req, res) => res.redirect(301, '/about/'));

app.get(/^\/([A-Za-z]{1,2}\d{1,2})\/?$/, (req, res, next) => {
  const series = req.params[0].toUpperCase();
  if (!data.ALLS.includes(series)) return next();
  if (req.path !== '/' + series.toLowerCase() + '/') return res.redirect(301, '/' + series.toLowerCase() + '/');
  const vid = visitor(req, res);
  const s = data.seo(series);
  const token = issueToken(series, vid, ipKey(req));
  const title = `${s.label} torque specs & service data · BoltSpec`;
  const desc = `${s.count.toLocaleString('en-GB')} tightening torques for the ${s.label}${s.engines.length ? ' (' + s.engines.join(', ') + ')' : ''}, plus service intervals and fluid capacities. Free, from BMW ISTA.`;
  const pop = s.popular.map((p) => p.rows.map((r) => `<tr><td>${esc(r.part)}</td><td class="mono">${esc(r.thread || '')}</td><td class="mono v">${esc(r.value)}</td></tr>`).join('')).join('');
  const seoHtml = `<section class="card bs-seo noprint" id="seo">
  <p class="bs-seo__lead">${s.engines.length ? `${s.count.toLocaleString('en-GB')} torque specs in ${s.groups.length} groups, for the engines ${esc(s.engines.join(', '))}.` : `${s.count.toLocaleString('en-GB')} torque specs in ${s.groups.length} groups.`}</p>
  ${pop ? `<details class="bs-seo__pop"><summary>Common torque specs</summary><table class="bs-pop"><tbody>${pop}</tbody></table><p class="bs-seo__fine">Values can depend on the engine and model year. Pick yours in the full list below.</p></details>` : ''}
</section>`;
  const loader = built.loader.replace('__KA__', keyA(token));
  htmlHeaders(res).send(fill(tpl.app, {
    V: VERSION, TITLE: esc(title), DESC: esc(desc), CANON: base(req) + '/' + series.toLowerCase() + '/',
    H1: `${esc(s.label)} <span class="u-bmw">Torque &amp; service</span>`, LEAD: 'Tightening torques, service plan and fluid capacities from BMW ISTA. Not affiliated with BMW AG.',
    SEO: seoHtml, BS: bsCfg({ series, t: token, eng: s.engines }), LOADER: loader,
    LD: json({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: base(req) + '/' + series.toLowerCase() + '/', isPartOf: { '@type': 'WebSite', name: 'BoltSpec', url: base(req) + '/' } }),
  }));
});

// ---------- classic cars: make pages (/volkswagen/) and model pages (/volkswagen/golf/) ----------
const crumbs = (items) => items.map(([href, t]) => (href ? `<a href="${href}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join(' <span aria-hidden="true">›</span> ');
const ldPage = (req, title, desc, url) => json({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: base(req) + url, isPartOf: { '@type': 'WebSite', name: 'BoltSpec', url: base(req) + '/' } });
app.get(/^\/([a-z][a-z0-9-]{1,30})\/?$/, (req, res, next) => {
  const m = classic.MAKE[req.params[0]];
  if (!m) return next();
  if (!req.path.endsWith('/')) return res.redirect(301, req.path + '/');
  visitor(req, res);
  const url = `/${m.slug}/`, title = `${m.name} service data & torque settings · BoltSpec`;
  const desc = `Engine, ignition, tyre and alignment data, torque settings and fluid capacities for ${m.models.length} classic ${m.name} models (1980–1997). Free.`;
  const list = `<ul class="bs-cars">${m.models.map((x) => `<li><a href="/${m.slug}/${x.slug}/"><b>${esc(x.name)}</b><span>${esc(x.years)} · ${x.n} variant${x.n === 1 ? '' : 's'}</span></a></li>`).join('')}</ul>`;
  htmlHeaders(res).send(fill(tpl.classic, {
    V: VERSION, TITLE: esc(title), DESC: esc(desc), CANON: base(req) + url, BS: bsCfg({ classic: 1, carLabel: m.name, carHref: '/#classic' }), LOADER: '', LD: ldPage(req, title, desc, url),
    CRUMBS: crumbs([['/', 'Home'], ['/#classic', 'Classic cars'], [null, m.name]]),
    H1: `${esc(m.name)} <span class="u-bmw">Service data</span>`, LEAD: 'From a 1997 automotive technical data book. Pick your model, then your engine.',
    MAIN: `<section class="card"><h2>Choose a model</h2>${list}</section>`,
  }));
});
app.get(/^\/([a-z][a-z0-9-]{1,30})\/([a-z0-9][a-z0-9-]{0,40})\/?$/, (req, res, next) => {
  const [make, model] = [req.params[0], req.params[1]];
  const s = classic.summary(make, model);
  if (!s) return next();
  const url = `/${make}/${model}/`;
  if (req.path !== url) return res.redirect(301, url);
  const vid = visitor(req, res);
  const car = classic.key(make, model);
  const token = issueToken(car, vid, ipKey(req));
  const name = `${s.make} ${s.model}`;
  const title = `${name} specs: torque settings, capacities & tune-up data · BoltSpec`;
  const desc = `${name}${s.years ? ' (' + s.years + ')' : ''}: engine, ignition, tyre pressures, wheel alignment, torque settings and fluid capacities for ${s.variants.length} engine variant${s.variants.length === 1 ? '' : 's'}. Free.`;
  const others = classic.MAKE[make].models.filter((x) => x.slug !== model);
  const H = classic.get(make, model).v;
  // the variant rows are rendered here (names only, good for search engines); the values arrive encrypted and fill in on open
  const main = `<section class="card sd-host" id="cl">
  <div class="sd-head"><h2>Choose your engine</h2><span class="muted">${H.length} engine${H.length === 1 ? '' : 's'}${s.years ? ' · ' + esc(s.years) : ''}</span><span class="muted sd-status" id="bsLoad" role="status"></span></div>
  ${svc.toolbar(H.length, true)}${svc.list(H)}<p class="muted sd-none" hidden>No engine matches.</p>
</section>
${others.length ? `<section class="card noprint"><h2>Other ${esc(s.make)} models</h2><ul class="bs-cars">${others.map((x) => `<li><a href="/${make}/${x.slug}/"><b>${esc(x.name)}</b><span>${esc(x.years)}</span></a></li>`).join('')}</ul></section>` : ''}`;
  htmlHeaders(res).send(fill(tpl.classic, {
    V: VERSION, TITLE: esc(title), DESC: esc(desc), CANON: base(req) + url, LD: ldPage(req, title, desc, url),
    BS: bsCfg({ make, model, key: car, t: token, classic: 1, carLabel: s.model, carHref: `/${make}/` }), LOADER: built.cloader.replace('__KA__', keyA(token)),
    CRUMBS: crumbs([['/', 'Home'], ['/#classic', 'Classic cars'], [`/${make}/`, s.make], [null, s.model]]),
    H1: `${esc(name)} <span class="u-bmw">Service data</span>`, LEAD: 'Torque settings, capacities, spark plugs, valve clearances, tyre pressures and tune-up data for each engine. From a 1997 automotive technical data book.',
    MAIN: main,
  }));
});

app.get('/robots.txt', (req, res) => {
  // search engines are welcome; AI training crawlers are not
  const ai = ['GPTBot', 'ChatGPT-User', 'CCBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Bytespider', 'PerplexityBot', 'Amazonbot', 'Applebot-Extended', 'Meta-ExternalAgent', 'cohere-ai', 'Diffbot', 'Omgilibot'];
  res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nDisallow: /admin/\nDisallow: /newsletter/\n\n${ai.map((b) => `User-agent: ${b}\nDisallow: /`).join('\n\n')}\n\nSitemap: ${base(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const u = (p, pr) => `<url><loc>${base(req)}${p}</loc><priority>${pr}</priority></url>`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${u('/', '1.0')}${data.ALLS.map((s) => u('/' + s.toLowerCase() + '/', '0.8')).join('')}${classic.MAKES.map((m) => u(`/${m.slug}/`, '0.6') + m.models.map((x) => u(`/${m.slug}/${x.slug}/`, '0.6')).join('')).join('')}${u('/about/', '0.3')}</urlset>`);
});

// ---------- newsletter (double opt-in) ----------
const msgPage = (res, title, body, status = 200) => htmlHeaders(res).status(status).send(fill(tpl.msg, { V: VERSION, BS: bsCfg(), TITLE: esc(title), BODY: body }));
// ---------- analytics beacon (cookieless, see src/analytics.js) ----------
app.post('/api/e', express.text({ type: '*/*', limit: '4kb' }), (req, res) => {
  res.status(204).end();
  if (req.get('Sec-Fetch-Site') && req.get('Sec-Fetch-Site') !== 'same-origin') return;
  if (limited('ev:' + ipKey(req), 120, 60e3)) return;
  let body; try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return; }
  let ownHost = ''; try { ownHost = new URL(base(req)).hostname.replace(/^www\./, ''); } catch {}
  analytics.record({ secret: SECRET, ip: ipKey(req), ua: req.get('User-Agent') || '', cc: req.get('CF-IPCountry'), ownHost, body });
});

app.post('/api/newsletter', async (req, res) => {
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin') return res.status(403).json({ error: 'origin' });
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'email' });
  if (limited('nl:' + ipKey(req), 6, 3600e3) || limited('nle:' + email, 3, 3600e3)) return res.status(429).json({ error: 'rate' });
  const s = await db.subscribe(email, ipKey(req));
  if (s.status !== 'confirmed') mail.queue({ to: email, kind: 'confirm', url: `${base(req)}/newsletter/confirm?t=${s.token}` });
  res.json({ ok: true }); // same answer whether or not the address was already on the list
});
app.get('/newsletter/confirm', async (req, res) => {
  const s = await db.confirm(String(req.query.t || ''));
  if (!s) return msgPage(res, 'Link expired', `<p>${'This confirmation link is no longer valid. Subscribe again from the form at the bottom of any page.'}</p>`, 400);
  msgPage(res, 'You are subscribed', `<p>${'Thanks! We will e-mail you when there is something new on BoltSpec. Every e-mail has a one-click unsubscribe link.'}</p>`);
});
app.get('/newsletter/unsubscribe', async (req, res) => {
  const s = await db.unsubscribe(String(req.query.u || ''));
  if (!s) return msgPage(res, 'Link not valid', `<p>${'We could not find this subscription. It may have been removed already.'}</p>`, 400);
  msgPage(res, 'You are unsubscribed', `<p>${'You will not get any more e-mails from BoltSpec.'}</p>`);
});
// one-click unsubscribe from mail clients (RFC 8058)
app.post('/newsletter/unsubscribe', express.urlencoded({ extended: false }), async (req, res) => { await db.unsubscribe(String(req.query.u || '')); res.json({ ok: true }); });

// ---------- admin (HTTP basic auth, user "admin") ----------
function adminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(404).send('Not found');
  const [, b64] = /^Basic (.+)$/.exec(req.get('authorization') || '') || [];
  const [u, p] = b64 ? Buffer.from(b64, 'base64').toString().split(':') : [];
  const ok = u === 'admin' && p && crypto.timingSafeEqual(crypto.createHash('sha256').update(p).digest(), crypto.createHash('sha256').update(ADMIN_PASSWORD).digest());
  if (ok) return next();
  if (limited('adm:' + ipKey(req), 20, 15 * 60e3)) return res.status(429).send('Too many attempts');
  res.set('WWW-Authenticate', 'Basic realm="BoltSpec admin", charset="UTF-8"').status(401).send('Sign in required');
}
app.use('/admin', adminAuth);
app.get('/admin/', (req, res) => { htmlHeaders(res).send(fill(tpl.admin, { V: VERSION, BS: bsCfg() })); });
app.get('/admin', (req, res) => res.redirect('/admin/'));
app.get('/admin/analytics/', (req, res) => { htmlHeaders(res).send(fill(tpl.analytics, { V: VERSION, BS: bsCfg() })); });
app.get('/admin/api/analytics', async (req, res) => res.json(await analytics.report(req.query.days)));
app.get('/admin/api/stats', async (req, res) => res.json({ ...(await db.stats()), mail: mail.MODE, campaign: mail.campaignStatus() }));
app.get('/admin/api/subscribers', async (req, res) => res.json(await db.list(String(req.query.q || ''), String(req.query.status || ''))));
app.get('/admin/api/subscribers.csv', async (req, res) => {
  const rows = await db.list('', 'confirmed', 100000);
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="boltspec-subscribers-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send('﻿email,confirmed_at\n' + rows.map((r) => [q(r.email), new Date(r.confirmed_at).toISOString()].join(',')).join('\n'));
});
app.delete('/admin/api/subscribers/:id', async (req, res) => { await db.remove(Number(req.params.id) || 0); res.json({ ok: true }); });
app.get('/admin/api/campaigns', async (req, res) => res.json(await db.campaigns()));
app.get('/admin/api/trace/:mark', async (req, res) => res.json(await db.trace(String(req.params.mark))));
app.post('/admin/api/send', async (req, res) => {
  const b = req.body || {};
  const msg = { subject: String(b.subject || '').slice(0, 200), body: String(b.body || '').slice(0, 20000) };
  if (!msg.subject || !msg.body) return res.status(400).json({ error: 'empty' });
  if (b.test) { mail.queue({ to: String(b.test).trim(), kind: 'update', msg, unsubUrl: `${base(req)}/newsletter/unsubscribe?u=test` }); return res.json({ ok: true, test: true }); }
  if (mail.campaignStatus().running) return res.status(409).json({ error: 'running' });
  const id = await mail.startCampaign(msg, base(req));
  res.json({ ok: true, id });
});

app.use((req, res) => msgPage(res, 'Page not found', '<p>The page you are looking for does not exist or has moved.</p>', 404));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'server' }); });

Promise.all([build(), db.init(analytics.SCHEMA)]).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`BoltSpec started: http://localhost:${PORT} · ${data.ALLS.length} series · e-mail: ${mail.MODE}${BMC ? ' · donations: ' + BMC : ''}`);
    if (!process.env.SECRET) console.warn('! SECRET is not set: page tokens reset on every restart.');
    if (!ADMIN_PASSWORD) console.warn('! ADMIN_PASSWORD is not set: the admin area is off.');
    if (!BMC) console.warn('! BMC_HANDLE is not set: the "Buy me a coffee" button is hidden.');
    mail.check().then((r) => console.log(r === 'log' ? 'E-mail: SMTP not set; messages are only shown in the admin area.' : r === 'ok' ? 'E-mail: SMTP connected.' : '! E-mail: SMTP does not respond – ' + r));
  });
  const stop = () => { server.close(); db.close().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}).catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
