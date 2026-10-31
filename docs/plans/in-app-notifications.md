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
| `customerReplied` | A customer writes on WhatsApp (not a button tap) | Notifications → Activity |
| `messageFailed` | A WhatsApp message to a customer failed | Notifications → Activity |
| `templateApproved` | Meta approved one of the business's messages | Notifications → Messages |
| `templateRejected` | Meta rejected one of the business's messages | Notifications → Messages |
| `koblipLimitNear` | The business used most of its Koblip-number templates this month | Notifications → Overview |
| `koblipLimitReached` | It used all of them | Notifications → Overview |
| `connectionRenew` | The business's Koblip Chat connection must be renewed | Integrations |

## Decisions log

| ID | Decision | Why | Who, date |
| --- | --- | --- | --- |
| N-D1 | Stored per business in `in_app_notifications` (id, business, kind, `data` JSON with the facts the title needs, `link` path, `readAt`, optional `dedupeKey`, `createdAt`). The words are made on screen from kind + data, in the reader's language. The bell lists every business the signed-in owner owns, newest first, each naming its business. Demo copies never get any. | Words in the data would freeze one language; one bell for all of an owner's businesses means nothing is missed. | Dev 3, 2026-10-30 |
| N-D2 | One shared function, `notify(businessId, kind, data, options)` in `lib/in-app-notifications.ts`, called where each event already happens. It returns a query for `saveAll` so a notification is saved together with what caused it. It skips a kind the owner turned off and a demo. A `dedupeKey` makes repeats one notification (once per booking and move, once per month). | Features may not import each other; saving with the cause keeps the two true together. | Dev 3, 2026-10-30 |
| N-D3 | Fresh counts, as the Next.js docs say: the owner layout renders the unread count on the server for the first paint; the bell then asks a Route Handler (`GET /api/notifications`, owner-only, no cache) every `inAppPollSeconds` while the tab is shown and when it comes back (client-side data fetching guide: interval polling against a Route Handler); the read actions are Server Functions that call `refresh()` from `next/cache` so the count on screen updates at once. No new library: a small client hook with `fetch` does the polling. | Route Handlers are the documented way for the browser to read on a timer; Server Functions are for changes. `router.refresh()` every few seconds would re-render the whole page. | Dev 3, 2026-10-30 |
| N-D4 | N1 as built. Kinds and `InAppData` live in `types/in-app-notifications.ts` (shared, so `lib/` can use them). `notification(businessId, kind, data, { dedupeKey, renew })` returns the writes to put in `saveAll` with the cause (a list: a query builder returned from an async function would run there); `notify(...)` saves on its own. `renew` brings one keyed notification back unread with new facts (a customer writing again). Links: bookings page for booking kinds, Notifications → Activity, → Customer messages, → Overview (the business page renamed in D36), Integrations. The bell reads `getUnreadCount()` and `getNotificationPage(cursor?)` (Server Components) or `GET /api/notifications?cursor=` → `{ unread, page: { items, nextCursor } }` (`private, no-store`, 401 when signed out); each item has `kind`, `businessId`, `businessName`, `timezone`, `data`, `link`, `read`, `at`. `markNotificationRead(id)` and `markAllNotificationsRead()` return `{ ok }` and call `refresh()`. Pages are cursor-based ("<createdAt>\|<id>") so new ones arriving never shift a page. The choices table (`in_app_notification_settings.turnedOff`, no row = all on) and the rules came with N1, so `notify` honours both from the start: `inAppKeepDays` 90, `inAppPageSize` 20, `inAppPollSeconds` 30, `koblipLimitNearPercent` 80, shown on WhatsApp → Rules in their own group. Migration 0026. | Dev 1 can build the bell against a finished contract; one migration for both tables; every rule is an A0 rule the admin already edits and logs. | Dev 3, 2026-10-30 |
| N-D5 | N2 as built. Each kind is made where its event already happens and saved in the same `saveAll` as the cause where there is one. Keys: `booking:<id>` (new online booking), `<kind>:<booking>:<moves>` (button answers, so a new answer after a move is news), `messageFailed:<booking>:<moves>` (with the owner's WhatsApp alert, once per booking like it), `koblipLimitNear:YYYY-MM` / `koblipLimitReached:YYYY-MM` (UTC month, as the count; near = the next template reaches `koblipLimitNearPercent` of the limit), `replied:<digits>` with `renew` (one per customer, back unread when they write again). A reply on the business's own number goes to every business on that number; on Koblip's number to the business whose message last reached that customer from it. `InAppData` gained `customerPhone` (a reply from someone with no booking has no name). Meta's answer only when a review Book knew of changes to approved or rejected (a template found already answered is not news); connection renewal only when a working connection stops. | Saved with the cause, the two never disagree; keys make repeats and retries harmless; "only on change" keeps the bell for news. | Dev 3, 2026-10-30 |
| N-D6 | N3 as built. `getNotificationChoices(businessId)` (Server Component, in `features/notifications/api/queries.ts`) gives every kind with `on`, or null when the business is not the owner's; `setNotificationChoice(businessId, kind, on)` (Server Function) returns `{ ok }` or `not_found` / `invalid` and calls `refresh()`. Each switch is one SQL statement on `turnedOff` (JSON functions), so two quick switches never undo each other. Turning a kind off stops new ones only; ones already in the bell stay. | The N7 screen needs only these two; a read-then-write would lose a switch. | Dev 3, 2026-10-30 |
| N-D7 | N5 as built. `removeOldNotifications()` in `lib/in-app-notifications.ts` deletes every notification, read or not, created more than `inAppKeepDays` ago (one rule for all businesses, not per business). The WhatsApp timer calls it on each check, in its own `try` so a failure is only logged and never stops the sending. | One timer already runs on the server; a second would be a second thing to watch. | Dev 3, 2026-10-30 |
| N-D8 | N6 as built. Admin → Notifications (`/admin/notifications`, bell in the admin menu): every stored notification, newest first, up to `listRows` (200), each with its business, customer or count, time in the business's zone and read or unread; filters for business, kind and read live in the address (`?business=&kind=&read=`) like Activity's. Under it, "Turned off by owners": each business whose owner turned kinds off, with those kinds, so the choices table is not hidden either. `BellIcon` added to `components/ui/icons.tsx` for this and the bell (N4). The rules stay on WhatsApp → Rules (N-D4). | Same shape as the admin's Activity, so nothing new to learn; both stored tables are visible. | Dev 3, 2026-10-30 |
| N-D9 | N4 as built. One `NotificationsProvider` (client) in the owner layout holds the bell's state and does the polling of N-D3 once, however many bells are on the page; the layout gives `<NotificationBell />` to the shell as a `bell` slot (the dashboard feature never imports notifications). The shell shows it in the top bar on a phone and atop the menu on a computer (beside Search, under it when the menu is folded). Phone: the stock bottom sheet (`components/bottom-panel.tsx`), "Mark all as read" in its footer (the Spanish label doesn't fit beside the title at 320px); computer: a Popover. Today / Earlier by the device's day; each row an Item with an icon per kind, the title made from kind + data, "business · time ago" and an unread dot; a tap marks it read at once (the Server Function and `refresh()` follow) and opens its link. "Show more" follows `nextCursor`; a poll merges the new first page over what is loaded. The count is a stock destructive Badge, "9+" above 9, on a background so the bell doesn't show through. `formatAgo` moved from the admin feature to `lib/format-ago.ts` so both use it. | One poller, one state; the slot keeps the import rules; stock parts only. | Dev 1, 2026-10-30 |
| N-D10 | N7 as built. `/dashboard/<business>/settings/notifications`: Bookings and WhatsApp groups (`CHOICE_GROUPS`, a test checks every kind is in one), one switch per kind as a stock Field choice card (the whole row is the tap target), saved on change with `useOptimistic`; a failed save shows a toast and the switch goes back. Reached from the bell's gear and a row on the business's Settings page; not the owner's business → 404. | The choices are per business (N3), so they live under its Settings. | Dev 1, 2026-10-30 |

## Tasks

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| N1 | Contract: types, table + migration, `notify()`, queries and actions for the bell (list newest first, paged; unread count; mark one read; mark all read), the Route Handler, the feature's ESLint zone | `features/notifications/types/`, `features/notifications/api/`, `lib/in-app-notifications.ts`, `lib/db/schema.ts` (+ migration), `app/api/notifications/route.ts`, `eslint.config.mjs` | — | `Done` 2026-10-30, see git log (N-D4) |
| N2 | Create each kind where its event already happens (booking made, button replies, WhatsApp replies, failed sends, Meta's review, Koblip limit, connection renewal) | `features/booking/api/create-booking.ts`, `features/dashboard/api/notification-replies.ts`, `chat-events.ts`, `notification-sender.ts`, `chat-templates.ts`, `chat-oauth.ts` | N1 | `Done` 2026-10-30, see git log (N-D5) |
| N3 | The owner's choices per business: which kinds they get (all on by default); query and action (the table came with N1) | `features/notifications/api/` | N1 | `Done` 2026-10-30, see git log (N-D6) |
| N4 | The bell: count, list as a sheet (phone: top bar; computer: sidebar), each opens its link and is marked read, "Mark all read", empty state; English and Spanish | `features/notifications/components/`, the owner shell | N1 | `Done` 2026-10-30, see git log (N-D9) |
| N5 | Notifications older than `inAppKeepDays` removed by the timer (the rules came with N1) | `notification-timer.ts`, `lib/in-app-notifications.ts` | N1 | `Done` 2026-10-30, see git log (N-D7) |
| N6 | Admin screen: every stored notification with filters (business, kind, read), English and Spanish | `app/(admin)/admin/notifications/`, `features/admin/` | N1 | `Done` 2026-10-30, see git log (N-D8) |
| N7 | Owner's choices screen (a list of kinds with switches) | `features/notifications/components/`, the business settings route | N3, N4 | `Done` 2026-10-30, see git log (N-D10) |
