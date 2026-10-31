# Google Calendar

Bookings go into Google Calendar, and busy times in Google Calendar cannot
be booked. Approved by the owner (2026-10-31): both ways, all the features
below, one at a time; team members connect through a simple link first, a
full team dashboard later. How to use this file: [Plans](README.md).

## Rules that always apply

- Google's docs first: [OAuth for web servers](https://developers.google.com/identity/protocols/oauth2/web-server),
  [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth),
  [events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert),
  [freeBusy.query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).
- Features never import each other. Talking to Google is shared code
  (`lib/google-calendar.ts`), so the booking feature can read busy times and
  the dashboard can sync; the screens and the sync job are `features/dashboard/`.
- Tokens are sealed with `lib/secret-box` and never leave the server.
- A slow or broken Google never slows down or blocks a booking: syncing runs
  on the server's timer, never inside the booking.
- Nothing hidden: every stored row and rule gets an admin screen (G11).

## What the owner sets up in Google Cloud (once)

The same project as Google login (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`):

1. Turn on the **Google Calendar API**.
2. Add the redirect URI `<BETTER_AUTH_URL>/api/google-calendar/callback`.
   Google's push calls go to `<BETTER_AUTH_URL>/api/google-calendar/notify` (HTTPS only; nothing to set up).
3. Data Access: add the scopes below. Before launch, Google checks the app (G12).

## Scopes (the least Google allows)

| Scope | Why |
| --- | --- |
| `openid email` | Show which Google account is connected |
| `calendar.app.created` | Make a "Koblip Book" calendar and manage only its events |
| `calendar.calendarlist.readonly` | List the calendars, so the owner picks which count as busy (G4) |
| `calendar.events.freebusy` | Read only busy times, never event details (G3) |

All are asked at once, so nobody reconnects when a later step ships. Google
lets a person untick scopes: only `calendar.app.created` is required; without
the others, busy times are simply off.

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| G1 | Owner connects Google on Integrations (popup, like Koblip Chat); a "Koblip Book" calendar is made; Disconnect; Reconnect when it stops working | | Done (2026-10-31) |
| G2 | Every booking goes into that calendar and stays in sync: new, moved, cancelled (server timer, once a minute) | G1 | Done (2026-10-31) |
| G3 | Busy times in Google cannot be booked (public page, owner's Add and Move booking); the owner picks which team member they are (Manage panel) | G1 | Done (2026-10-31) |
| G4 | Owner picks which calendars count as busy | G3 | To do |
| G5 | Each team member's own calendar: the owner sends a link, the member connects Google on one simple page, no account; only their bookings, only their busy times | G2, G3 | To do |
| G6 | Event details: customer name, phone, service, team member, note, link to the booking | G2 | To do |
| G7 | Colour by service | G2 | To do |
| G8 | Customer gets a calendar invite | G2 | Decision: bookings have no customer email today |
| G9 | Sync now button | G2 | To do |
| G10 | Disconnect: keep or remove the Koblip events | G1 | To do |
| G11 | Admin screen: every connection, last sync, errors | G2 | To do |
| G12 | Text and steps for Google's app check | G4 | To do |

## Decisions

| What | Why | Who, date |
| --- | --- | --- |
| Own OAuth flow, not Better Auth's `linkSocial` | Team members connect without an account (G5), and the connection belongs to the business, not the login | Dev, 2026-10-31 |
| Events go into an app-made "Koblip Book" calendar | `calendar.app.created` can touch nothing else in the owner's Google | Dev, 2026-10-31 |
| Event id = a hash of the booking id (hex) | Google accepts our own ids (base32hex); a retry never makes a second event | Dev, 2026-10-31 |
| A changed booking is found by a fingerprint of its synced fields | One check finds new, moved, cancelled and edited bookings, like the WhatsApp timer | Dev, 2026-10-31 |
| Disconnect revokes the token at Google | Google's guide; it also resets the Google login consent, which only asks again once | Dev, 2026-10-31 |
| A calendar removed in Google is noticed at the next booking change, then made again with every event | Checking it every minute would cost one Google call per connection per minute | Dev, 2026-10-31 |
| A calendar belongs to a person: with no team the owner's busy times block the whole business; with a team they block the member the owner picks, or nobody | How SaaS booking apps (Square, Fresha, Acuity) sync calendars; the owner's dentist visit never closes a whole salon | Dev, 2026-10-31 |
| Busy times: Google push notifications on each busy calendar, read again with freeBusy when Google calls, plus a safety read every hour (Google says some push messages get lost); every 2 minutes only where Google can't call back (no HTTPS, e.g. localhost). Kept in `google_calendar_busy`; bookings read the kept ones | Google's push guide; a booking never waits on Google | Dev, 2026-10-31 (replaces 2-minute polling) |
| The owner can still book over a Google busy time, like any other busy time (the "book anyway" choice) | Owner bookings already allow a conflict on purpose | Dev, 2026-10-31 |
| Booking changes go to Google right after they are saved (`requestGoogleSync`); the 1-minute timer is only the safety net | Changes show at once; nothing is lost if a send fails | Dev, 2026-10-31 |
| Push channels are renewed 24 hours before Google ends them, the old one stopped after the new one starts | Google never renews a channel itself | Dev, 2026-10-31 |
