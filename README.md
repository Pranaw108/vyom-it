# Vyom IT website

Marketing website and lead system for Vyom IT (provisional brand name). Static pages on Cloudflare, a small Worker backend for the contact and quote forms, and a role-based admin panel.

Scope, requirements (FR/NFR IDs) and test cases are defined in the SOW.

## Stack

| Layer | Choice |
|---|---|
| Framework | Astro 7, TypeScript (strict), Preact islands for forms |
| Styling | Tailwind CSS v4 with design tokens in `src/styles/global.css` |
| Hosting | Cloudflare Workers with static assets (`@astrojs/cloudflare`) |
| Data | Cloudflare D1 (leads, content, users, audit log), R2 (images) |
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

## Admin panel

Team members sign in at `/auth/login` with a username and password, or with Google if their account email matches. There is no public sign-up: only an Owner creates accounts, and each new person sets their own password through a one-time link.

- **Passwords:** PBKDF2-SHA256 (100,000 iterations, the Workers maximum) with a per-password salt and a server-side pepper (`PASSWORD_PEPPER`). Plain passwords are never stored or logged.
- **Sessions:** stored server-side in D1 (only a SHA-256 of the token). Cookie `vyom_session` is HttpOnly, Secure and SameSite=Lax. They expire after 12 hours, or after 2 hours idle, and are revoked on logout, password change, disable or "Sign out everywhere".
- **Defences:** one generic error for any failed sign-in; a lockout after 5 failures per username or 20 per IP in 15 minutes; Origin checks on sign-in forms; a CSRF token on every admin change.
- **Authorisation:** checked on the server for every admin page and API. A signed-out request gets 401 (APIs) or a redirect to login (pages); a missing permission gets 403.
- **Client accounts:** Owners can create restricted *Client* accounts that see only the permissions ticked for them.
- **Cloudflare Access:** optional. If it is configured, its token is verified as well.

One-time link from the command line (for example, the very first Owner password):

```bash
node scripts/admin-setup-link.mjs <username> --remote --site https://<site>
```

Run it in your own terminal. The link is printed only there, works once, and expires after 24 hours.

Locally, add to `.dev.vars`:

```text
CSRF_SECRET=any-local-value
PASSWORD_PEPPER=any-local-value
DEV_ADMIN_EMAIL=owner@localhost.test
INITIAL_OWNER_EMAIL=owner@localhost.test
```

`DEV_ADMIN_EMAIL` signs you in automatically, and only on `localhost` / `127.0.0.1`. The first visit by `INITIAL_OWNER_EMAIL` creates the first Owner.

Content edited in the admin is stored in D1. The public site is static: publishing triggers a rebuild (`DEPLOY_HOOK_URL`), and the build reads only published content:

```bash
npm run db:migrate:local
npm run seed:local                 # copy src/data seed content into D1 (never overwrites)
CONTENT_SOURCE=local npm run build # build from published D1 content instead of the seed files
```

| Role | Can do |
|---|---|
| Owner | Everything, including users, lead export, erasing data, audit log |
| Content manager | Edit and publish content and team profiles |
| Contributor | Edit content and submit it for review |
| Sales | View and update leads |
| Viewer | Read content |

## Checks

```bash
npm run check        # Astro and TypeScript type check
npm test             # unit tests
npm run build
npm run test:e2e     # browser + accessibility tests (starts a preview server)
npm run test:api     # API checks; needs `npx astro preview` running
npm run test:perf    # byte budgets + Lighthouse; needs `npx astro preview` running
```

## Configuration

| Name | Where | Purpose |
|---|---|---|
| `SITE_URL`, `COMPANY_NAME`, `LEAD_NOTIFY_TO`, `LEAD_ACK_ENABLED`, `LEAD_REPLY_TIME`, `MAIL_FROM` | `wrangler.jsonc` vars | Non-secret runtime settings |
| `TURNSTILE_SECRET`, `IP_HASH_SALT`, `RESEND_API_KEY`, `CSRF_SECRET`, `PASSWORD_PEPPER`, `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, `INITIAL_OWNER_EMAIL`, `DEPLOY_HOOK_URL` | `wrangler secret put` / `.dev.vars` | Secrets, never committed |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | `wrangler.jsonc` vars | Cloudflare Access application for `/admin` |
| `CONTENT_SOURCE` | build environment | `remote` in production so the build reads published D1 content |
| `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_INDEXING` | build environment / `.env` | Public build settings; `PUBLIC_INDEXING=false` blocks search indexing on previews |
| `SITE_URL` | build environment | Canonical URLs and sitemap |

The D1 `database_id` in `wrangler.jsonc` is a placeholder until the client's Cloudflare account is set up.

## Documentation

| Document | For |
|---|---|
| [docs/DEPLOY.md](docs/DEPLOY.md) | First-time Cloudflare setup and the release flow |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Environments, variables and secrets |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | What to do when something goes wrong |
| [docs/MIGRATION.md](docs/MIGRATION.md) | Moving to another host |
| [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) | Client inputs and pre-launch checks |
| [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md) | How the team uses the admin panel |
