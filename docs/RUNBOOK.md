# Runbook

What to do when something goes wrong. The admin dashboard shows lead email, live-site and backup health first; start there.

## Lead alert emails are failing

**Symptom:** dashboard shows "retrying" or "not delivered"; red banner in Leads.

1. Leads are never lost: every enquiry is saved before any email is sent. Open **Leads** and reply to anyone marked "not delivered" directly.
2. Check `LEAD_NOTIFY_TO` is set and correct.
3. Check the Resend dashboard: API key valid, domain still verified, daily limit (100 on the free plan) not reached.
4. Failed alerts retry every 15 minutes, up to 5 times. After fixing the cause, new leads deliver normally.

## The live site did not update after publishing

**Symptom:** dashboard shows "Rebuild failed to start" or "Rebuild overdue".

1. Cloudflare dashboard → Workers → vyom-website → Builds: open the latest build log.
2. A content error stops the build with a clear message (e.g. `services.2.faqs.1.answer: Too small`). Fix it in the admin and publish again.
3. If the deploy hook failed, check the `DEPLOY_HOOK_URL` secret still matches the hook in Builds settings.
4. The live site keeps showing the last good version until a build succeeds.

## A bad release

Roll back to the previous version (under 5 minutes):

```bash
npx wrangler deployments list
npx wrangler rollback
```

Or Dashboard → Workers → vyom-website → Deployments → roll back.

## Restore the database

D1 keeps 7 days of history (Time Travel).

```bash
npx wrangler d1 time-travel info vyom-website
npx wrangler d1 time-travel restore vyom-website --timestamp=2026-11-03T10:00:00Z
```

Restoring replaces the whole database with its state at that time: leads, content and users after that point are lost. Export first if unsure: `npx wrangler d1 export vyom-website --remote --output=backup.sql`.

## Someone asks us to delete their data

1. Find the lead in **Leads** (search by name or email).
2. Open it → **Erase personal data** → give the reason → type `ERASE`.
3. The personal details are removed permanently; a record that the request was handled stays in the history and audit log.
4. Delete the notification email from the team inboxes too. Reply to the person within 30 days.

## A team member leaves

1. **Accounts** → Disable. This signs them out everywhere at once.
2. Remove them from the Cloudflare Access policy.
3. If they knew any secret (for example a shared API key), rotate it with `npx wrangler secret put`.

## A secret may have leaked

Rotate it immediately (`npx wrangler secret put <NAME>`), then:

| Secret | Also do |
|---|---|
| `RESEND_API_KEY` | Revoke the old key in Resend |
| `TURNSTILE_SECRET` | Rotate in the Turnstile dashboard |
| `CSRF_SECRET` | Nothing else; admins may need to reload open pages |
| `IP_HASH_SALT` | Nothing else; rate limits reset |
| `PASSWORD_PEPPER` | Every password stops working: issue reset links to everyone (`node scripts/admin-setup-link.mjs <username> --remote --site …` for the Owner) |
| `SESSION_SECRET` | Nothing else; a Google sign-in in progress must start again |

If an account may be compromised: **Accounts** → *Sign out everywhere*, then send that person a reset link. Repeated failed sign-ins appear in the audit log as `auth.failed`.

Then review **Audit log** and the Access sign-in logs for anything unexpected.
