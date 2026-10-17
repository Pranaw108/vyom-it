# Launch checklist

## Waiting on the client

| Item | Needed for | Status |
|---|---|---|
| Final brand name and domain | Logo, emails, `SITE_URL` | Pending |
| Lead inbox email address(es) | `LEAD_NOTIFY_TO` | Pending |
| Cloudflare account (developer invited) | Hosting, database, Access | Pending |
| Founders' names, bios, photos and written consent | Team section | Pending |
| Public email, phone, business hours; WhatsApp number (optional) | Site settings | Pending |
| Approval of all page copy | Content | Pending |
| Legal review of privacy, terms and cookie pages | Launch | Pending; set `legalReviewed = true` in `src/data/legal.ts` after approval |
| Admin users and roles | Users page, Access policy | Pending |

## Before switching the domain on

- [ ] `npm run check`, `npm test`, `npm run test:e2e` pass
- [ ] `npm run test:perf` against the production build: all budgets met
- [ ] Test enquiry on the live site arrives in the lead inbox and in **Leads**
- [ ] Acknowledgement email arrives at the visitor (after the domain is verified in Resend)
- [ ] `/admin` asks for sign-in; a non-allowed email is refused
- [ ] Founders' Owner accounts created; the developer's role reduced as agreed
- [ ] `PUBLIC_INDEXING=true` on production only; `robots.txt` allows crawling; `sitemap-index.xml` lists all pages
- [ ] Google Search Console and Bing Webmaster Tools verified (DNS); sitemap submitted
- [ ] Security headers present (`curl -I https://<domain>/`)
- [ ] D1 restore tested once on a copy (see RUNBOOK)
- [ ] Recorded admin walkthrough: founders edit service text, add a project, update founder details, view a lead

## Phase 2 (about 3 working weeks after launch)

Version history and restore, trash with 30-day recovery, full media library, redirect manager, weekly database export.
