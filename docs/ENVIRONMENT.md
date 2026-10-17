# Environments and configuration

| Environment | URL | Database | Emails | Search indexing | Admin sign-in |
|---|---|---|---|---|---|
| Local | `http://localhost:4321` | Local D1 copy (`.wrangler/`) | Logged to the console | Off | `DEV_ADMIN_EMAIL` (localhost only) |
| Preview | Per pull request, from Workers Builds | Staging D1 (recommended) or production read-only | Internal test inbox only | Off (`PUBLIC_INDEXING=false`) | Cloudflare Access |
| Production | Client domain | Production D1 | Lead inbox + visitor acknowledgement | On | Cloudflare Access |

## Settings

| Name | Kind | Purpose |
|---|---|---|
| `SITE_URL` | var + build var | Canonical URLs, sitemap, admin links in emails |
| `COMPANY_NAME` | var | Name in emails |
| `LEAD_NOTIFY_TO` | var | Comma-separated inboxes that receive lead alerts |
| `LEAD_ACK_ENABLED` | var | `true` once the sending domain is verified in Resend |
| `LEAD_REPLY_TIME` | var | Reply promise in acknowledgement emails |
| `MAIL_FROM` | var | Sender, e.g. `Vyom IT <hello@domain>` |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | var | Cloudflare Access application protecting `/admin` |
| `TURNSTILE_SECRET` | secret | Server-side spam check |
| `IP_HASH_SALT` | secret | Salt for hashed IP addresses (raw IPs are never stored) |
| `CSRF_SECRET` | secret | Signs admin form tokens |
| `RESEND_API_KEY` | secret | Email sending; empty locally |
| `INITIAL_OWNER_EMAIL` | secret | Becomes the first Owner on first sign-in |
| `DEPLOY_HOOK_URL` | secret | Rebuild trigger used when content is published |
| `DEV_ADMIN_EMAIL` | local only | Automatic admin sign-in on localhost; never set in production |
| `PUBLIC_TURNSTILE_SITE_KEY` | build var | Spam check widget |
| `PUBLIC_INDEXING` | build var | `false` blocks indexing (`noindex` + disallow-all robots.txt) |
| `CONTENT_SOURCE` | build var | `remote` in production: build from published D1 content |

Local values go in `.env` (build) and `.dev.vars` (runtime); both are git-ignored. Templates: `.env.example`, `.dev.vars.example`.

Cloudflare's documented Turnstile test keys (always pass) are used locally and in CI: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
