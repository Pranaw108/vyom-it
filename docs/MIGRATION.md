# Moving to another host

The site is built to move with little change. Most of it is plain static files.

| Part | Today | Where it lives in code | To move |
|---|---|---|---|
| Public pages | Static files on Cloudflare | `dist/client` after build | Serve from any host or Nginx; copy the security headers from `public/_headers` |
| Lead form API | Worker | `src/pages/api/leads.ts`, `src/server/leads/*` | Switch Astro to the Node adapter; implement `LeadStore` (`src/server/leads/store.ts`) for Postgres or SQLite |
| Lead emails | Resend | `src/server/mail/mailer.ts` | Implement `Mailer` for another provider (one class) |
| Admin sign-in | Cloudflare Access | `src/server/admin/access.ts`, `context.ts` | Put another identity provider in front of `/admin` and replace `verifyAccessToken` (the only Access-specific code) |
| Content, users, audit | D1 (SQLite) | `src/server/content/*`, `src/server/admin/*` | Export (`wrangler d1 export`), import into SQLite/Postgres, adjust SQL dialect if Postgres |
| Images | R2 | `src/pages/api/admin/media.ts`, `src/pages/media/[...key].ts` | Any S3-compatible storage |
| Scheduled jobs | Workers cron | `src/worker.ts` | System cron calling the same functions (`retryLeadEmails`, `applyRetention`) |
| Spam protection | Turnstile | `src/server/security/turnstile.ts` | Works on any host; keep it |

Estimated effort for a full move to a Node server: 3–6 person-days, mostly the database layer.

## DNS cut-over (no downtime)

1. Lower the DNS TTL to 300 seconds, 48 hours before.
2. Deploy the new host in parallel and test it with a hosts-file override.
3. Export the database again just before switching, then switch the DNS records.
4. Watch for 24 hours (test enquiry, admin sign-in, images).
5. Keep the old deployment for 7 days, then remove it and restore the normal TTL.
