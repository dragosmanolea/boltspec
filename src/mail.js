// E-mail through any SMTP provider. Without SMTP_HOST, messages are only logged (shown in the admin area's last-messages list).
const db = require('./db');

const HOST = process.env.SMTP_HOST || '';
const FROM = process.env.MAIL_FROM || 'BoltSpec <no-reply@boltspec.example>';
const MODE = HOST ? 'smtp' : 'log';
let transport = null;
function getTransport() {
  if (transport || MODE !== 'smtp') return transport;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = require('nodemailer').createTransport({
    host: HOST, port, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000, pool: true, maxConnections: 2,
  });
  return transport;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#b84a00">${u}</a>`);
function layout(paragraphs, button, foot) {
  const p = (t, st = '') => `<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:#1b1e22;${st}">${t}</p>`;
  return `<!DOCTYPE html><html lang="en"><body style="margin:0;background:#e9ebee;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#1b1e22;padding:16px 24px;font-size:20px;font-weight:bold;letter-spacing:.5px;color:#f4f4f2">BOLT<span style="color:#f2660f">SPEC</span></div>
<div style="background:#fafaf8;padding:24px;border:1px solid #cfd3d8;border-top:0">${paragraphs.map((x) => p(linkify(x))).join('')}
${button ? `<p style="margin:20px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#f2660f;color:#1b1e22;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:3px">${esc(button.label)}</a></p>` : ''}
</div>${foot ? `<p style="margin:14px 0 0;font-size:12px;line-height:18px;color:#5b626b">${foot}</p>` : ''}</div></body></html>`;
}
function build(m) {
  if (m.kind === 'confirm') {
    const lines = ['Please confirm that you want BoltSpec updates at this address.', 'If you did not ask for this, ignore this e-mail and you will not hear from us.'];
    return { subject: 'Confirm your BoltSpec subscription', text: `${lines[0]}\n\nConfirm: ${m.url}\n\n${lines[1]}`, html: layout(lines.slice(0, 1), { label: 'Confirm', url: m.url }, esc(lines[1])) };
  }
  // an update written in the admin area
  const paras = m.msg.body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return {
    subject: m.msg.subject, text: `${m.msg.body}\n\n--\nUnsubscribe: ${m.unsubUrl}`,
    html: layout(paras, null, `You get this because you subscribed to BoltSpec updates. <a href="${esc(m.unsubUrl)}" style="color:#5b626b">Unsubscribe</a>`),
    headers: { 'List-Unsubscribe': `<${m.unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}
const recent = []; // last messages, for the admin area
async function send(m) {
  const b = build(m);
  recent.unshift({ to: m.to, kind: m.kind, subject: b.subject, text: b.text, at: Date.now(), status: MODE === 'smtp' ? 'sending' : 'not sent (no SMTP)' }); recent.length = Math.min(recent.length, 30);
  const rec = recent[0];
  if (MODE !== 'smtp') { console.log(`[mail] (not sent, no SMTP) ${m.kind} → ${m.to}`); return true; }
  try { await getTransport().sendMail({ from: FROM, to: m.to, subject: b.subject, text: b.text, html: b.html, headers: b.headers }); rec.status = 'sent'; return true; }
  catch (e) { rec.status = 'error: ' + e.message; console.error('[mail]', m.kind, m.to, e.message); return false; }
}
const queue = (m) => { send(m).catch((e) => console.error('[mail]', e.message)); };
// Sends one update to every confirmed subscriber, a few per second, in the background.
let campaign = { running: false };
async function startCampaign(msg, base) {
  const subs = await db.confirmedAll();
  const id = await db.newCampaign(msg.subject, subs.length);
  campaign = { running: true, id, total: subs.length, sent: 0, failed: 0 };
  (async () => {
    for (const s of subs) {
      const ok = await send({ to: s.email, kind: 'update', msg, unsubUrl: `${base}/newsletter/unsubscribe?u=${s.unsub}` });
      ok ? campaign.sent++ : campaign.failed++;
      if ((campaign.sent + campaign.failed) % 20 === 0) await db.campaignProgress(id, campaign.sent, campaign.failed, false).catch(() => {});
      await new Promise((r) => setTimeout(r, Number(process.env.MAIL_DELAY_MS || 250)));
    }
    await db.campaignProgress(id, campaign.sent, campaign.failed, true).catch((e) => console.error('[mail]', e.message));
    campaign.running = false;
  })();
  return id;
}
const campaignStatus = () => ({ ...campaign, recent: recent.slice(0, 15) });
async function check() { if (MODE !== 'smtp') return 'log'; try { await getTransport().verify(); return 'ok'; } catch (e) { return 'error: ' + e.message; } }
module.exports = { MODE, queue, startCampaign, campaignStatus, check };
