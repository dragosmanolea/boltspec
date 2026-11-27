// PostgreSQL storage: newsletter subscribers, sent campaigns, the log of watermarks handed out with the data,
// and (in analytics.js) the cookieless analytics events. Connection: DATABASE_URL.
const crypto = require('crypto');
const { Pool, types } = require('pg');

types.setTypeParser(20, Number); // BIGINT (timestamps in ms, counts) as JS numbers
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://boltspec:boltspec@localhost:5432/boltspec',
  max: Number(process.env.DB_POOL || 10),
});
pool.on('error', (e) => console.error('[db]', e.message));

const all = async (sql, params = []) => (await pool.query(sql, params)).rows;
const one = async (sql, params = []) => (await pool.query(sql, params)).rows[0];
const run = (sql, params = []) => pool.query(sql, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS subscribers(id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', token TEXT NOT NULL, unsub TEXT NOT NULL, ip TEXT,
  created_at BIGINT NOT NULL, confirmed_at BIGINT, unsub_at BIGINT);
CREATE INDEX IF NOT EXISTS subscribers_token ON subscribers(token);
CREATE INDEX IF NOT EXISTS subscribers_unsub ON subscribers(unsub);
CREATE TABLE IF NOT EXISTS campaigns(id BIGSERIAL PRIMARY KEY, subject TEXT, total INT, sent INT DEFAULT 0, failed INT DEFAULT 0,
  status TEXT, created_at BIGINT NOT NULL, finished_at BIGINT);
CREATE TABLE IF NOT EXISTS issued(mark TEXT NOT NULL, vid TEXT, ip TEXT, series TEXT, at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS issued_mark ON issued(mark);
CREATE INDEX IF NOT EXISTS issued_at ON issued(at);
`;

// Creates the tables (idempotent). Retries while the database container is still starting.
async function init(extraSchema = '') {
  for (let i = 1; ; i++) {
    try { await pool.query(SCHEMA + extraSchema); return; } catch (e) {
      if (i >= 30) throw e;
      console.log(`[db] waiting for PostgreSQL (${e.code || e.message})…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const tok = () => crypto.randomBytes(24).toString('base64url');
const PENDING_MS = 3 * 864e5; // unconfirmed sign-ups expire after 3 days

async function subscribe(email, ip) {
  const s = await one('SELECT * FROM subscribers WHERE email=$1', [email]);
  if (s && s.status === 'confirmed') return s;
  if (s) return one("UPDATE subscribers SET status='pending', token=$1, created_at=$2, ip=$3 WHERE id=$4 RETURNING *", [tok(), Date.now(), ip, s.id]);
  return one(`INSERT INTO subscribers(email,token,unsub,ip,created_at) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING *`, [email, tok(), tok(), ip, Date.now()]);
}
async function confirm(token) {
  const s = token && await one("SELECT * FROM subscribers WHERE token=$1 AND status IN ('pending','confirmed')", [token]);
  if (!s || (s.status === 'pending' && Date.now() - s.created_at > PENDING_MS)) return null;
  if (s.status !== 'confirmed') await run("UPDATE subscribers SET status='confirmed', confirmed_at=$1 WHERE id=$2", [Date.now(), s.id]);
  return s;
}
async function unsubscribe(u) {
  const s = u && await one('SELECT * FROM subscribers WHERE unsub=$1', [u]);
  if (!s) return null;
  await run("UPDATE subscribers SET status='unsubscribed', unsub_at=$1 WHERE id=$2", [Date.now(), s.id]);
  return s;
}
async function stats() {
  const r = Object.fromEntries((await all('SELECT status, COUNT(*)::int n FROM subscribers GROUP BY status')).map((x) => [x.status, x.n]));
  const week = (await one("SELECT COUNT(*)::int n FROM subscribers WHERE status='confirmed' AND confirmed_at>$1", [Date.now() - 7 * 864e5])).n;
  return { pending: r.pending || 0, confirmed: r.confirmed || 0, unsubscribed: r.unsubscribed || 0, week };
}
const list = (search, status, limit = 500) => all(
  `SELECT id,email,status,created_at,confirmed_at,unsub_at FROM subscribers WHERE email ILIKE $1 ${status ? 'AND status=$3' : ''} ORDER BY created_at DESC LIMIT $2`,
  ['%' + search.replace(/[\\%_]/g, '\\$&') + '%', limit, ...(status ? [status] : [])]);
const confirmedAll = () => all("SELECT id,email,unsub FROM subscribers WHERE status='confirmed' ORDER BY id");
const remove = (id) => run('DELETE FROM subscribers WHERE id=$1', [id]);
const newCampaign = async (subject, total) => Number((await one("INSERT INTO campaigns(subject,total,status,created_at) VALUES($1,$2,'sending',$3) RETURNING id", [subject, total, Date.now()])).id);
const campaignProgress = (id, sent, failed, done) => (done
  ? run("UPDATE campaigns SET sent=$1, failed=$2, status='done', finished_at=$3 WHERE id=$4", [sent, failed, Date.now(), id])
  : run('UPDATE campaigns SET sent=$1, failed=$2 WHERE id=$3', [sent, failed, id]));
const campaigns = () => all('SELECT * FROM campaigns ORDER BY id DESC LIMIT 50');
const trace = (mark) => all('SELECT vid, ip, series, at FROM issued WHERE mark=$1 ORDER BY at', [mark]);

// Batched multi-row insert: rows are buffered in memory and written every `ms` (or when `max` is reached),
// so a burst of requests costs one query instead of hundreds.
function batcher(table, cols, ms = 2000, max = 500) {
  let buf = [];
  const flush = async () => {
    if (!buf.length) return;
    const rows = buf; buf = [];
    const vals = [], ph = rows.map((r, i) => '(' + cols.map((_, j) => '$' + (i * cols.length + j + 1)).join(',') + ')');
    rows.forEach((r) => vals.push(...r));
    try { await run(`INSERT INTO ${table}(${cols.join(',')}) VALUES ${ph.join(',')}`, vals); } catch (e) { console.error(`[db] ${table} insert failed:`, e.message); }
  };
  setInterval(flush, ms).unref();
  return { push(row) { buf.push(row); if (buf.length >= max) flush(); }, flush };
}
const issuedLog = batcher('issued', ['mark', 'vid', 'ip', 'series', 'at']);
const logIssue = (mark, vid, ip, series) => issuedLog.push([mark, vid, ip, series, Date.now()]);
const flushers = [issuedLog.flush];

// housekeeping: expired sign-ups and old watermark logs
setInterval(() => {
  run("DELETE FROM subscribers WHERE status='pending' AND created_at<$1", [Date.now() - 30 * 864e5]).catch(() => {});
  run('DELETE FROM issued WHERE at<$1', [Date.now() - 180 * 864e5]).catch(() => {});
}, 3600e3).unref();

// Writes buffered rows and closes the pool (called on shutdown).
async function close() { for (const f of flushers) await f(); await pool.end(); }

module.exports = { pool, all, one, run, init, batcher, flushers, close, subscribe, confirm, unsubscribe, stats, list, confirmedAll, remove, newCampaign, campaignProgress, campaigns, logIssue, trace };
