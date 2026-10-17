# Admin guide

For the Vyom IT team. Go to **yourdomain.com/admin** and sign in with your work Google account.

## What you can do depends on your role

| Role | You can |
|---|---|
| Owner | Everything: content, leads, users, exporting leads, erasing data, audit log |
| Content manager | Edit and publish website content and team profiles |
| Contributor | Edit content and send it for review |
| Sales | See and update leads |
| Viewer | Read content |

## The dashboard

The top row shows whether things are healthy:

- **Lead emails:** green means alerts are reaching the inbox. Amber means some are retrying. Red means some could not be delivered: reply to those people from **Leads**.
- **Live website:** shows whether your latest published changes are live yet.

## Editing the website

1. Open **Content** and choose what to edit (for example **Services**).
2. Change the text and select **Save draft**. Visitors do not see drafts.
3. When it's ready:
   - **Content managers and Owners:** select **Publish**. The live site updates within a few minutes.
   - **Contributors:** select **Submit for review**. A content manager or Owner then publishes it.
4. If publishing is refused, the panel lists what to fix, for example "every FAQ needs an answer".

Tips:

- **Lists** (like FAQs) have ↑ ↓ to reorder and **Remove** to delete an item.
- Fields that say "one per line" take one item on each line.
- The **order of services and projects** is set on their list page with ↑ ↓; this updates the live site straight away.
- **Take offline** removes a service or project from the website without deleting it.
- If someone else saved the same item while you were editing, you'll be asked to reload. Copy your changes first.

## Team profiles

Only publish someone after they have agreed in writing. Record the date and where the agreement is saved in **Consent to publish**; the site will not publish a profile without it. For the photo, describe the image first, then choose the file. It's resized automatically.

## Projects

- **Concept projects** are self-made examples. They are always labelled "Concept project" and cannot show numbers or results.
- **Client projects** need the client's written permission recorded before they can be published, and every number needs a source.

## Leads

1. Open **Leads**. Search by name, email or company, or filter by status.
2. Open a lead to see the full request and its history.
3. Update the **Status** as you work on it (new → contacted → qualified → won/lost).
4. Add **internal notes** for the team. Visitors never see them.
5. Owners can **Export CSV** of the current filter.

If someone asks you to delete their data, an Owner opens the lead and uses **Erase personal data**. This cannot be undone.

## Users (Owners)

- **Add a person:** name, work email, role. Also add their email to the Cloudflare Access policy so they can sign in.
- **Change role** or **Disable** someone at any time. It takes effect immediately.
- There must always be at least one Owner.

## Audit log (Owners)

Every change made in the admin is recorded: who, what and when. Nobody can edit or delete entries; they are removed automatically after 24 months.
