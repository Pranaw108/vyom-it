# Deploying to Cloudflare

First-time setup and the normal release flow. Everything is created in the **client's own Cloudflare account**, with the developer invited as a member.

## 1. One-time setup

Run these from the project folder after `npx wrangler login` (signed in to the client's account).

| Step | Command or action | Then |
|---|---|---|
| Database | `npx wrangler d1 create vyom-website` | Copy the `database_id` into `wrangler.jsonc` |
| Tables | `npx wrangler d1 migrations apply vyom-website --remote` | |
| Content | `node scripts/seed-content.mjs --remote` | Copies the approved seed copy into the admin (never overwrites) |
| Image storage | `npx wrangler r2 bucket create vyom-website-media` | |
| Spam protection | Dashboard → Turnstile → Add widget for the site's hostnames | Site key → build variable `PUBLIC_TURNSTILE_SITE_KEY`; secret → `TURNSTILE_SECRET` |
| Email | Resend → add and verify the company domain (SPF, DKIM, DMARC records in Cloudflare DNS) | API key → `RESEND_API_KEY`; set `MAIL_FROM`, then `LEAD_ACK_ENABLED=true` |
| Admin sign-in | Zero Trust → Access → Applications → Self-hosted. Path: `<domain>/admin*` and `<domain>/api/admin/*`. Policy: allow the team's emails. Identity: Google (2-step verification enforced) or one-time PIN | Team domain → `ACCESS_TEAM_DOMAIN`; Application AUD tag → `ACCESS_AUD` |
| Analytics | Dashboard → Web Analytics → enable for the site | Cookieless; nothing to configure in code |

Secrets (never committed):

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put IP_HASH_SALT        # any long random string
npx wrangler secret put CSRF_SECRET         # any long random string
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put INITIAL_OWNER_EMAIL # the first Owner's sign-in email
npx wrangler secret put DEPLOY_HOOK_URL     # from step 2
```

Variables in `wrangler.jsonc` → `vars`: `SITE_URL`, `COMPANY_NAME`, `LEAD_NOTIFY_TO` (comma-separated inboxes), `LEAD_REPLY_TIME`, `MAIL_FROM`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.

## 2. Automatic builds (Workers Builds)

Dashboard → Workers → vyom-website → Settings → Builds → connect the GitHub repository.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variables | `SITE_URL=https://<domain>`, `CONTENT_SOURCE=remote`, `PUBLIC_TURNSTILE_SITE_KEY=<site key>`, `PUBLIC_INDEXING=true` (production only) |
| Deploy hook | Create one; save its URL as the `DEPLOY_HOOK_URL` secret |

`CONTENT_SOURCE=remote` makes the build read **published** admin content from D1. The build needs permission to read D1: confirm on the first build; if it fails with an authentication error, add a Cloudflare API token with "D1 Read" as the build variable `CLOUDFLARE_API_TOKEN`.

Preview builds (pull requests) must use `PUBLIC_INDEXING=false` so they are never indexed. Protect preview URLs with Access as well, or keep the admin disabled there.

## 3. Releasing a change

1. Open a pull request. CI must pass (type check, unit tests, browser and accessibility tests).
2. Check the preview link.
3. Merge to `main`. Cloudflare builds and deploys automatically.
4. Check the live site: home page, a service page, a test enquiry (it should arrive in the lead inbox), `/admin`.

Database changes: apply migrations **before** merging code that needs them:

```bash
npx wrangler d1 migrations apply vyom-website --remote
```

## 4. Custom domain

Dashboard → Workers → vyom-website → Settings → Domains → add the domain (it must use Cloudflare DNS). HTTPS is automatic. Then update `SITE_URL` (variable and build variable), the Turnstile widget hostnames and the Access application, and consider `"workers_dev": false` in `wrangler.jsonc` so only the real domain serves the site.
