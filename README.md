# BoltSpec

Free torque specs for BMW, MINI and Rolls-Royce. English only.
No accounts. Newsletter for update announcements. Buy Me a Coffee button for donations.

## Run

> **Data file not in this repo.** `src/torque-data.json` (the ISTA dataset) is git-ignored on purpose,
> so the full dataset never ends up on GitHub. Copy it into `src/` from your local copy or the server
> before running or packing; the app will not start without it.
>
> `src/service-data.json` (per-engine service data from a 1997 data book: BMW "Engine data" tab and the classic-car
> pages) is git-ignored the same way. It is optional: without it the site runs without those parts. Rebuild it with
> `node tools/build-service-data.js haynes-data.json --makes=BMW --classic`.

- **Mac:** double-click `start.command` (needs Docker Desktop). `stop.command` stops it.
- **Manually:** `cp .env.example .env`, edit it, then `docker compose up -d --build`.
- **Without Docker:** Node 22+, PostgreSQL 14+, `npm ci`, then `DATABASE_URL=postgres://… npm start` (reads env vars, not `.env`). Tables are created on first start.

Open `http://localhost:3090/`. Admin: `/admin/` (user `admin`, password = `ADMIN_PASSWORD`). Analytics: `/admin/analytics/`.

> The data is decrypted in the browser with WebCrypto, which only works on **https** or **localhost**.
> In production put the site behind https (Cloudflare recommended) and set `TRUST_PROXY=1`.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `SECRET` | Signs page tokens and derives encryption keys. Long and random. Changing it invalidates open pages only. |
| `ADMIN_PASSWORD` | Password for `/admin/`. |
| `PUBLIC_URL` | Public base URL, used in e-mails, canonical links and the sitemap. |
| `BMC_HANDLE` | Your buymeacoffee.com handle. Empty hides the coffee button. |
| `CONTACT_EMAIL` | Shown on the About page. |
| `TRUST_PROXY` | `1` behind Cloudflare/nginx so the real client IP is used for limits. |
| `CARS_PER_HOUR`, `CARS_PER_DAY` | Max distinct cars per visitor and per IP. |
| `POSTGRES_PASSWORD` | Password of the bundled PostgreSQL container. Set it before the first start. |
| `DATABASE_URL` | Only without Docker: connection string to your PostgreSQL. |
| `GSC_VERIFY`, `BING_VERIFY` | Verification codes for Google Search Console and Bing Webmaster Tools. |
| `SMTP_*`, `MAIL_FROM` | Outgoing mail. Without `SMTP_HOST` mails are only logged (visible in admin). |

## Structure

```
server.js          routes, token/encryption endpoint, newsletter, admin
src/data.js        per-series slices of the dataset, SEO data
src/torque.js      spec lookup by part category (popular specs per page)
src/classic.js     classic cars (other makes, 1980–1997): make/model index and encrypted model payloads
src/db.js          PostgreSQL: subscribers, campaigns, issued watermarks, batched inserts
src/analytics.js   cookieless analytics: beacon handling and dashboard report
src/mail.js        SMTP / log mode, templates, throttled campaigns
views/             server-rendered pages + the inline loader
public/assets/     torque module (app.js), shell, styles, icons, svcdata.js (per-engine service data view)
tools/             build-service-data.js + classic-families.js: build src/service-data.json from the extracted data book
```

## Anti-cloning

The full dataset never reaches the browser.

1. Each car page (`/f10/`) gets only its own series slice.
2. The slice comes from `/api/v1/d/:series` and is gzip + AES-256-GCM encrypted. Half of the key is baked into the page, half is sent per response.
3. The page token is signed and bound to the series, a visitor cookie and the IP, and expires after 15 minutes. Cross-site requests are refused.
4. Limits: 40 requests/min per IP; at most 30 distinct cars/hour and 120/day per visitor and per IP. Reopening the same car is free.
5. Every slice carries an invisible per-visitor watermark, logged for 180 days. Paste a mark into *Admin → Trace a copy* to see who received it.
6. JS is minified and mangled. `robots.txt` blocks AI crawlers and `/api/`.

**Limit:** a determined scraper driving real browsers across many IPs can still collect the data slowly. These measures make it expensive and traceable, not impossible. Cloudflare bot protection in front adds a strong extra layer.

## Newsletter

Double opt-in: subscribe → confirmation e-mail → confirmed. Each update e-mail has a one-click unsubscribe link (RFC 8058 headers). In admin you can see stats, search and delete subscribers, export CSV, send a test, and send an update to everyone.

## Analytics

First-party and cookieless, so no cookie banner is needed. The browser sends a tiny beacon to `/api/e`; nothing is stored on the device and no third-party script is loaded.

- **Counted:** page views, traffic sources (Google, Reddit, forums… and UTM campaigns), cars opened, engines picked, searches with their number of results, Buy Me a Coffee clicks, newsletter sign-ups, copies, visitors that hit the car limit, device type, country (from Cloudflare's `CF-IPCountry`).
- **Visitors** are a hash of IP + browser with a salt that changes daily: no IP or cookie is stored, and the same person on two days counts twice.
- **Bots** (by user agent and `navigator.webdriver`) and admin pages are ignored. Events are kept 400 days.
- **Dashboard** `/admin/analytics/`: KPIs vs. the previous period, visitors per day, sources, conversions by source, popular cars and engines, searches and searches with no results (good hints for missing translations), UTM campaigns, devices, countries.
- **Campaign links:** add `?utm_source=reddit&utm_medium=social&utm_campaign=launch` (or simply `?ref=forum`) to links you share.

## Google Search Console

1. In Search Console add a *URL prefix* property for your domain and choose the **HTML tag** method.
2. Copy only the `content="…"` value into `GSC_VERIFY` in `.env`, restart, then click *Verify*.
3. Under *Sitemaps* submit `https://your-domain/sitemap.xml`.

The same works for Bing Webmaster Tools with `BING_VERIFY`.

## Backups

`docker compose exec db pg_dump -U boltspec boltspec > backup.sql` (restore with `psql`). The database lives in the `pgdata` Docker volume.

## Legal

The About page states that BoltSpec is not affiliated with BMW AG and that values are for reference only. Review the rights to the source data and the use of BMW/MINI trademarks before launch.
