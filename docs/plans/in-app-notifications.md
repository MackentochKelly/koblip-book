# In-app notifications

A bell in the owner area: what happened with bookings and WhatsApp, as a
list the owner opens, with a count of what is new. Approved by the owner
(2026-10-30). How to use this file: [Plans](README.md).

## Start here (every developer)

1. Read, in this order: [AGENTS.md](../../AGENTS.md), [Plans](README.md), this
   whole file, [WhatsApp notifications v2](whatsapp-notifications.md) (where
   most events come from) and [the UI checklist](../ui-rules/checklist.md).
2. Claim your task as [Plans](README.md) says. Need a decision? Make the
   best one, log it below (what, why, who, date) in the same commit.

Rules that always apply:

- Features never import each other. Creating a notification is shared code
  (`lib/in-app-notifications.ts`), so every feature where an event happens
  can call it; reading and changing them for the bell is
  `features/notifications/`.
- Nothing hidden: what is stored and every rule has an admin screen.
- Typecheck, lint, test and build before `Done`; UI tasks also pass the UI
  checklist on phone and computer, light and dark, English and Spanish.

## Lanes

| Lane | Developer | Owns | Tasks, in order |
| --- | --- | --- | --- |
| Server | Dev 3 | `lib/in-app-notifications.ts`, `features/notifications/api/`, `features/notifications/types/`, the table and migration, the calls where events happen | N1, N2, N3, N5, N6 |
| UI | Dev 1 | `features/notifications/components/`, the bell in the owner shell, the owner's choices screen | N4, N7 |

## Goals

- One bell in the owner area (top bar on a phone, sidebar on a computer)
  with the number of unread notifications; it opens a list as a sheet.
- Each notification says what happened, for which business, when, and opens
  the right place (the booking, Activity, the message, Integrations).
- The owner chooses, per business, which kinds they get (all on at first).
- Nothing is lost or hidden: the admin sees every stored notification and
  the rules (how long they are kept, page size, how often the bell checks).

## Kinds

| Kind | When | Opens |
| --- | --- | --- |
| `newBooking` | A customer books online | The bookings page |
| `customerCancelled` | A customer cancels with "Can't make it" (owner chose "cancel") | The bookings page |
| `customerConfirmed` | A customer taps "I'll be there" | The bookings page |
| `customerCantCome` | A customer taps "Can't make it" (owner chose "only alert") | The bookings page |
| `customerReplied` | A customer writes on WhatsApp (not a button tap) | WhatsApp → Activity |
| `messageFailed` | A WhatsApp message to a customer failed | WhatsApp → Activity |
| `templateApproved` | Meta approved one of the business's messages | WhatsApp → Customer messages |
| `templateRejected` | Meta rejected one of the business's messages | WhatsApp → Customer messages |
| `koblipLimitNear` | The business used most of its Koblip-number templates this month | WhatsApp → Overview |
| `koblipLimitReached` | It used all of them | WhatsApp → Overview |
| `connectionRenew` | The business's Koblip Chat connection must be renewed | Integrations |

## Decisions log

| ID | Decision | Why | Who, date |
| --- | --- | --- | --- |
| N-D1 | Stored per business in `in_app_notifications` (id, business, kind, `data` JSON with the facts the title needs, `link` path, `readAt`, optional `dedupeKey`, `createdAt`). The words are made on screen from kind + data, in the reader's language. The bell lists every business the signed-in owner owns, newest first, each naming its business. Demo copies never get any. | Words in the data would freeze one language; one bell for all of an owner's businesses means nothing is missed. | Dev 3, 2026-10-30 |
| N-D2 | One shared function, `notify(businessId, kind, data, options)` in `lib/in-app-notifications.ts`, called where each event already happens. It returns a query for `saveAll` so a notification is saved together with what caused it. It skips a kind the owner turned off and a demo. A `dedupeKey` makes repeats one notification (once per booking and move, once per month). | Features may not import each other; saving with the cause keeps the two true together. | Dev 3, 2026-10-30 |
| N-D3 | Fresh counts, as the Next.js docs say: the owner layout renders the unread count on the server for the first paint; the bell then asks a Route Handler (`GET /api/notifications`, owner-only, no cache) every `inAppPollSeconds` while the tab is shown and when it comes back (client-side data fetching guide: interval polling against a Route Handler); the read actions are Server Functions that call `refresh()` from `next/cache` so the count on screen updates at once. No new library: a small client hook with `fetch` does the polling. | Route Handlers are the documented way for the browser to read on a timer; Server Functions are for changes. `router.refresh()` every few seconds would re-render the whole page. | Dev 3, 2026-10-30 |

## Tasks

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| N1 | Contract: types, table + migration, `notify()`, queries and actions for the bell (list newest first, paged; unread count; mark one read; mark all read), the Route Handler, the feature's ESLint zone | `features/notifications/types/`, `features/notifications/api/`, `lib/in-app-notifications.ts`, `lib/db/schema.ts` (+ migration), `app/api/notifications/route.ts`, `eslint.config.mjs` | — | `Working on` Dev 3, 2026-10-30 |
| N2 | Create each kind where its event already happens (booking made, button replies, WhatsApp replies, failed sends, Meta's review, Koblip limit, connection renewal) | `features/booking/api/create-booking.ts`, `features/dashboard/api/notification-replies.ts`, `chat-events.ts`, `notification-sender.ts`, `chat-templates.ts`, `chat-oauth.ts` | N1 | `To do` |
| N3 | The owner's choices per business: which kinds they get (all on by default); query and action | `features/notifications/api/`, `lib/db/schema.ts` (+ migration) | N1 | `To do` |
| N4 | The bell: count, list as a sheet (phone: top bar; computer: sidebar), each opens its link and is marked read, "Mark all read", empty state; English and Spanish | `features/notifications/components/`, the owner shell | N1 | `To do` |
| N5 | Rules as A0 rules (kept for, page size, how often the bell checks, "near" the Koblip limit) and old ones removed by the timer | `lib/notification-rules.ts`, `notification-timer.ts`, admin Rules names | N1 | `To do` |
| N6 | Admin screen: every stored notification with filters (business, kind, read), English and Spanish | `app/(admin)/admin/notifications/`, `features/admin/` | N1 | `To do` |
| N7 | Owner's choices screen (a list of kinds with switches) | `features/notifications/components/`, the business settings route | N3, N4 | `To do` |
