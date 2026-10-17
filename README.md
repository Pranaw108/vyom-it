# Vyom IT website

Marketing website and lead system for Vyom IT (provisional brand name). Static pages on Cloudflare, a small Worker backend for the contact and quote forms, and (in progress) a role-based admin panel.

Scope, requirements (FR/NFR IDs) and test cases are defined in the SOW.

## Stack

| Layer | Choice |
|---|---|
| Framework | Astro 7, TypeScript (strict), Preact islands for forms |
| Styling | Tailwind CSS v4 with design tokens in `src/styles/global.css` |
| Hosting | Cloudflare Workers with static assets (`@astrojs/cloudflare`) |
| Data | Cloudflare D1 (leads), R2 (media, planned) |
| Email | Resend (falls back to console logging when no key is set) |
| Spam protection | Cloudflare Turnstile, honeypot, 5-per-10-minute rate limit |
| Tests | Vitest (unit), Playwright + axe-core (browser and accessibility) |

## Project structure

```text
src/
  pages/            routes; api/leads.ts is the only server route so far
  components/       ui/, layout/, sections/, work/, forms/ (Preact)
  data/             seed content (replaced by the admin panel's published content later)
  lib/schemas/      Zod schemas: the build fails on invalid content
  lib/leads/        form rules shared by browser and server
  server/           leads service, D1 store, mailer, Turnstile, hashing
  worker.ts         Worker entry: Astro handler + scheduled jobs (email retries, retention)
migrations/         D1 SQL migrations
tests/              unit/ and e2e/
scripts/            screenshots, accessibility report, API smoke test
```

## Run locally

Requires Node 22.22 or later.

```bash
npm install
cp .env.example .env              # public build settings (Turnstile test key)
cp .dev.vars.example .dev.vars    # local secrets; see below
npx wrangler d1 migrations apply vyom-website --local
npm run dev                       # http://localhost:4321
```

For local `.dev.vars`, Cloudflare's documented Turnstile test secret always passes:

```text
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
IP_HASH_SALT=any-local-value
RESEND_API_KEY=
```

With no `RESEND_API_KEY`, emails are logged instead of sent.

## Checks

```bash
npm run check        # Astro and TypeScript type check
npm test             # unit tests
npm run build
npm run test:e2e     # browser + accessibility tests (starts a preview server)
npm run test:api     # API checks; needs `npx astro preview` running
```

## Configuration

| Name | Where | Purpose |
|---|---|---|
| `SITE_URL`, `COMPANY_NAME`, `LEAD_NOTIFY_TO`, `LEAD_ACK_ENABLED`, `LEAD_REPLY_TIME`, `MAIL_FROM` | `wrangler.jsonc` vars | Non-secret runtime settings |
| `TURNSTILE_SECRET`, `IP_HASH_SALT`, `RESEND_API_KEY` | `wrangler secret put` / `.dev.vars` | Secrets, never committed |
| `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_INDEXING` | build environment / `.env` | Public build settings; `PUBLIC_INDEXING=false` blocks search indexing on previews |
| `SITE_URL` | build environment | Canonical URLs and sitemap |

The D1 `database_id` in `wrangler.jsonc` is a placeholder until the client's Cloudflare account is set up.
