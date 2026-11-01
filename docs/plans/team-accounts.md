# Team accounts and profiles

Each team member gets their own sign-in and dashboard, and their own public
profile that customers can book from, like Fresha's employee profile.
Asked by the owner (2026-11-01): team dashboard first, then the profile.
How to use this file: [Plans](README.md).

## Rules that always apply

- Accounts are Better Auth's (email + password or Google, the same login
  page as owners). A team member is linked to an account by
  `team_members.user_id`; the business keeps its one owner (`ownerId`).
- Owner pages stay owner-only (`ownedBusiness`). The team area has its own
  route group `app/(team)`, its own check (`requireTeamMember` in
  `lib/dal.ts`) and only ever reads that one member's rows.
- Invite links work like the Google Calendar links (`lib/team-invites.ts`):
  a long random token, only its hash kept, one use, a few days, and a new
  link for the same person ends the old one.
- Features never import each other: the owner side is `features/dashboard`,
  the team area `features/team-area`, the public profile
  `features/business-page`.

## What a team member can do

| Area | Can | Cannot |
| --- | --- | --- |
| Bookings | See their own upcoming and past bookings | See other people's bookings, move or cancel |
| Hours | See their own weekly hours | Change them (the owner does) |
| Profile | Change their photo, job title, about and languages | Change their name, services or prices |

Everything else (customers, revenue, settings, WhatsApp, the assistant)
stays owner-only.

## Public profile (`/b/[slug]/team/[memberId]`)

Photo, name, job title, the business's area; appointments completed and
clients served (from bookings); About; Languages; their services with Book
buttons; Book now with them already picked.

Not copied from Fresha: per-person ratings and reviews (our reviews come
from Google and name no team member) and a per-person portfolio (no photos
per person yet).

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| T1 | Schema: `team_members.user_id`, `about`, `languages`; `team_invites` | | Done (2026-11-01) |
| T2 | Owner invites a team member from Team (link to copy or share, email when they have one); shows who joined; remove access | T1 | Done (2026-11-01) |
| T3 | Join page `/join/[token]`: sign in or create an account, then join | T1 | Done (2026-11-01) |
| T4 | Team area `/team/[memberId]`: Bookings, Hours, Profile; login lands there for someone with no business | T1 | Done (2026-11-01) |
| T5 | Public profile page; team photos on the business page open it; booking from it starts with that person | T1 | Done (2026-11-01) |
| T6 | Owner edits About and Languages in the team member form | T1 | Done (2026-11-01) |
| T7 | Team members change their own photo (the photo field moves to `components/` with its words as props) | T4 | To do |
| T8 | Admin screen for team accounts and open invite links (nothing hidden) | T2 | To do |
| T9 | Booking from a profile: the service step lists only that person's services, and the professional step is skipped | T5 | To do |
| T10 | A team member's About in the page's other language (like services' translations) | T5 | To do |

## Decisions log

| What | Why | Who, date |
| --- | --- | --- |
| A `user_id` on `team_members`, not Better Auth's organization plugin | The business table is already the tenant and every owner check reads `ownerId`; a second membership store would split the truth | Claude, 2026-11-01 |
| The job title is the existing `description` ("one short line customers see under the name") | Same field, already shown in booking | Claude, 2026-11-01 |
| The team area shows customers' names, not their phone numbers | Customers' contact details stay with the owner | Claude, 2026-11-01 |
| Team members see their bookings but can't move or cancel them | The owner keeps control of the calendar; widen later if asked | Claude, 2026-11-01 |
