# WhatsApp notifications v2

Booking messages on WhatsApp through Koblip Chat, rebuilt so the owner sees
and controls everything, customers can answer with buttons, and nothing is
sent to Meta without the owner's OK. How Book and Chat talk is in
[Koblip Chat integration](../koblip-chat-integration.md). How to use this
file: [Plans](README.md).

## Start here (every developer)

1. Read, in this order: [AGENTS.md](../../AGENTS.md), [Plans](README.md), this
   whole file, [Koblip Chat integration](../koblip-chat-integration.md), Chat's
   `wapi-api/docs/api/oauth.md`, and [the UI checklist](../ui-rules/checklist.md).
2. Set up: [Local setup](../setup.md). Test against a local Koblip Chat
   (`wapi-api` on port 5000, `Wapi-frontend` on 3000), never production.
3. Pick your lane below (write your name next to it), then claim your lane's
   first open task as [Plans](README.md) says.
4. Need a decision? Make the best one yourself, the way the docs and the
   goals here point, and write it in the Decisions log below (what, why, who,
   date) in the same commit. Nobody waits for the owner.

Rules that always apply:

- Book uses Koblip Chat only through Chat's public API, like any other
  company. A change in Chat must be a general API feature, never Book-only.
- Nothing hidden: anything you store or any rule you add gets its admin
  screen (see below). Secrets only in `.env.local`, only in server code.
- Commit only your own files. Pull (`git pull --rebase`) before every push.
- Database: one migration per task, made right before you commit. If
  someone else's migration landed first, pull, delete yours and generate it
  again.
- Shared files (`lib/db/schema.ts`, `features/dashboard/api/notifications.ts`,
  `features/dashboard/api/notification-actions.ts`): change only your own
  part, pull just before you edit, commit soon.
- Typecheck, lint, test and build before `Done`; UI tasks also pass the UI
  checklist on phone and computer, light and dark, English and Spanish.

## Lanes (five developers side by side)

Each lane owns its files, so lanes never block each other. Work your lane's
tasks top to bottom; when a task waits on another lane, take your next one.

| Lane | Developer | Owns | Tasks, in order |
| --- | --- | --- | --- |
| 1. Chat API and platform | Dev 1 | `Wapi/wapi-api`, `chat-oauth.ts`, `lib/platform-settings.ts`, `lib/notification-rules.ts` | C1, C2, K1, A0 |
| 2. Templates and sending | Dev 2 | `booking-templates.ts`, `chat-templates.ts`, `notification-sender.ts`, `lib/whatsapp-offer.ts` | S1, S2, S4, S6, S8, K2, K3, S5, K5, K6 |
| 3. Replies, activity, bookings | Dev 3 | `chat-events.ts`, `notification-replies.ts`, `booking-actions.ts`, booking components | S3, S9, S7, B1 |
| 4. Business page | Dev 4 | `app/(owner)/dashboard/[businessId]/whatsapp/`, `features/dashboard/components/whatsapp-*.tsx`, `message-editor.tsx`, `features/dashboard/i18n/*/whatsapp.ts` | P1, P5, P6, P7, P3, P2, P4, K4 |
| 5. Admin dashboard | | `app/(admin)/admin/whatsapp/`, `features/admin/` | A1, A2, A4, A6, A5, A7, A3, A8 |
| Everyone, last | | | F1 |

Every lane can start today: lanes 4 and 5 begin with their frames (P1, A1)
on today's data, and the server lanes need nothing but W0, which is done.

## Goals

- The WhatsApp page is split into clear parts (below), with professional
  names, phone first.
- Reminders have buttons: "I'll be there" / "Can't make it". A tap changes
  the booking and tells the owner.
- Nothing goes to Meta until the owner presses "Submit to Meta".
- The 24-hour rule is a visible setting: inside 24 hours of the customer's
  last message a normal message goes (free); outside it, the approved
  template.
- Every message, reply and failure is visible in Activity.
- One wording for every kind of business (salon, clinic, gym…): no words that
  fit only one trade, and the business's name in every message.

## Two ways to send (agreed with the owner, 2026-10-30)

| | Koblip number (default) | The business's own number |
| --- | --- | --- |
| When | Every business, from the start, with no setup | After the business connects its own Koblip Chat workspace |
| Sender | Koblip's own WhatsApp number | The business's number |
| Templates | Koblip's ready-made set, made and approved once in Koblip's workspace | The business's own copies in its workspace |
| The business can | See every message, turn each on or off | Also edit wording and buttons, submit to Meta |
| 24-hour normal messages | Only if the customer wrote to Koblip's number | If the customer wrote to the business's number |
| Who pays Meta | Koblip | The business's Chat account |

Book connects to Koblip's own Chat workspace once, as the platform (like any
app, through Chat's public API). Each business's page shows which number it
sends from.

## Nothing hidden (agreed with the owner, 2026-10-30)

Every record Book keeps for WhatsApp and every rule it follows has a screen
in the admin dashboard (`/admin`), where Koblip's admin can see it, change it
or remove it. Secrets are the one exception: the admin sees whether each is
set, never its value. Every admin change is logged (who, what, when).

| Kept by Book | Admin screen |
| --- | --- |
| Koblip's own Chat connection and number | WhatsApp → Koblip number |
| Koblip's ready-made templates and Meta's review | WhatsApp → Koblip messages |
| Each business's connection, number, sender | WhatsApp → Businesses → one business |
| Each business's settings, wording, templates, on/off | WhatsApp → Businesses → one business |
| Every message sent, waiting, failed or skipped, and each reply | WhatsApp → Activity |
| Who wrote in the last 24 hours (`chat_replies`) | WhatsApp → 24-hour window |
| Rules (reminder choices, quiet hours defaults, limits, 24-hour margin, words per field, button limits, batch size, timer) | WhatsApp → Rules |
| Messages sent from Koblip's number per business, and the limit | WhatsApp → Usage |
| Timer health, waiting and failed counts, Chat reachable, secrets set or not | WhatsApp → Overview |
| Every admin change | WhatsApp → Change log |

## Consistency for every screen

- Business page and admin use the same shared parts (`components/`), the same
  names for the same things, English and Spanish.
- Phone first: a list of parts that each open their own screen; computer:
  tabs. No sideways scroll at 320 px, 44 px touch targets, light and dark.
- Each screen passes [the UI checklist](../ui-rules/checklist.md) before it
  is marked `Done`.

## The page

| Part | What the owner does there |
| --- | --- |
| Overview | Connection, number, Meta review, a setup checklist (Connected → Reviewed → Submitted → Approved → Live), "Send a test to my phone" |
| Customer messages | Booking confirmed, Reminder, Booking changed, Booking cancelled: on/off, wording in English and Spanish, buttons, fields, live preview, Meta status and reason, "Submit to Meta" |
| Your alerts | To the owner's WhatsApp: New booking, Customer can't come, Customer cancelled, Message failed |
| Timing | Reminder times, quiet hours, the 24-hour setting |
| Replies | What each button does ("Can't make it": cancel and free the time, or only alert the owner), thank-you reply on/off |
| Activity | Every message: who, which, when, normal or template, delivered/read, the customer's answer; filters, search, "Send again" for failed |

Phone: one list of the parts, each opens its own screen. Computer: tabs.
Every screen passes [the UI checklist](../ui-rules/checklist.md).

## Decisions log

The owner asked the team to decide (2026-10-30). Add new decisions at the
bottom: what, why, who, date.

| ID | Decision | Why | Who, date |
| --- | --- | --- | --- |
| D1 | Delete the 10 templates waiting at Meta in the "Koblip Chat Agency" workspace (S2). New names end in `_v2`: Meta blocks a deleted name for about 4 weeks. Koblip's ready-made set is named `koblip_<message>_v2`, a business's own copies `koblip_book_<message>_v2`, so both can live in one account. | They have no buttons, were sent without the owner's OK, and cannot be edited while waiting. | Lane 0, 2026-10-30 |
| D2 | "Can't make it" only alerts the owner by default; the owner can switch it to "cancel and free the time" on Replies. | A wrong tap must never cancel a booking on its own; the owner stays in control. | Lane 0, 2026-10-30 |
| D3 | Koblip's number: 300 template messages per business per month by default (normal messages inside 24 hours do not count). At the limit, template messages stop for that business, the owner sees why, and the admin sees it in Usage. The admin changes the limit for everyone or one business. | Koblip pays Meta for these; a limit keeps the cost known, and the admin can raise it. | Lane 0, 2026-10-30 |
| D4 | Activity search (S9) matches the customer's name in any case (SQLite's LIKE: accented letters must be typed as stored), or the phone by its digits however it is typed (through the booking's `customer_key`). `%` and `_` are taken literally. Results stay newest first, capped at `historySize`. `notificationHistoryFor(businessId, filter)` keeps its name; the filter is optional, so today's page works unchanged. | One search box covers names and numbers; `customer_key` already holds the phone's digits, so no new column or migration. | Dev 3, 2026-10-30 |
| D5 | Moving a booking (B1): each `notification_sends` row records `visit_at`, the visit time it is about, and "once" means once per booking, message, reminder time and visit time. A move sets the booking's waiting reminders and "changed" message to skipped (`moved`). The sender then queues "Booking changed" and plans reminders for the new time (Dev 2, in `plan()`). The move action lives in `features/booking/api/move-owner-booking.ts`, next to `createOwnerBooking`, and the page passes it in. | Without the visit time, a second move could not send a second "changed" message and a reminder already sent would block the new one. The opening-hours and busy checks live in `features/booking`, which `features/dashboard` may not import. | Dev 3 with Dev 2, 2026-10-30 |
| D6 | C1: Chat's inbound app event gets `button: { payload, title }` (null when no button was tapped). The payload is the one set when the message was sent; `replyToMessageId` is the provider ID of the message that carried the button, so Book can match a tap to the send it answers. Template quick replies and normal-message buttons arrive the same way. Sales gets the same field and ignores it. | A general API field any app can use; Chat already stored the tap, it just did not forward it. | Dev 1, 2026-10-30 |

## Tasks

The contract (W0) is done; every lane builds on it. Which lane does which
task is in Lanes above.

### Contract

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| W0 | (Lane 0) Types and settings shape for everything below: sender (Koblip or own), message buttons, reply actions, the 24-hour setting, "Can't make it" action, alerts, activity rows and filters, setup steps. Settings and send columns in the database with defaults. UI and server both build against it. | `features/dashboard/types/notifications.ts`, `lib/notification-rules.ts`, `lib/db/schema.ts` (+ `drizzle/0017`) | — | `Done` 2026-10-30, see git log |

### Chat API (`Wapi/wapi-api`, general features only)

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| C1 | Inbound app events carry the tapped button's payload and title | `services/koblip-sales-status-webhook.service.js`, `tests/oauth-events.test.js`, `docs/api/oauth.md` | — | `Done` 2026-10-30, Chat 3bf10c2 |
| C2 | Send API: a normal message with reply buttons can have a text title and footer | `controllers/unified-whatsapp.controller.js`, its service, tests, docs | — | `Working on` Dev 1, 2026-10-30 |

### Book server

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| S1 | Templates with buttons; nothing created or submitted automatically; "Submit to Meta" action per message and language; Meta's reason kept and shown; buttons, review and reason filled in `notificationMessagesFor` | `features/dashboard/utils/booking-templates.ts`, `features/dashboard/api/chat-templates.ts`, `notification-actions.ts`, `notifications.ts` | W0 | `Working on` Dev 2, 2026-10-30 |
| S2 | Remove the 10 waiting templates (D1) and move to the `_v2` names | `features/dashboard/api/chat-templates.ts`, a one-off script in `scripts/` | S1 | `To do` |
| S3 | Replies: a button tap finds the message by Chat's record id (works for both numbers), saves the reply, confirms or cancels the booking per the owner's setting (D2), queues the owner's alert, sends the thank-you | `features/dashboard/api/chat-events.ts`, new `features/dashboard/api/notification-replies.ts` | W0, C1 | `To do` |
| S4 | The 24-hour setting in the sender; inside the window send a normal message with buttons; `saveNotificationSettings` takes the three new settings (24-hour, "Can't make it", thank-you) | `notification-sender.ts`, `notification-actions.ts` | W0, C2 | `To do` |
| S5 | Owner alerts: Customer can't come, Customer cancelled, Message failed | `features/dashboard/api/notification-sender.ts`, `booking-templates.ts` | S1, S3 | `To do` |
| S6 | More fields: team member, price, address, duration (and a manage-booking link once a manage page exists) | `booking-templates.ts`, `notification-sender.ts` | W0 | `To do` |
| S7 | Opt-out: a customer who writes STOP (or BAJA) gets no more messages; the sender asks `notification-replies.ts` whether a number opted out | `chat-events.ts`, `notification-replies.ts` (one call added in the sender by lane 2) | S3 | `To do` |
| S8 | Test send to the owner's phone; "Send again" for a failed message | `notification-actions.ts`, `notification-sender.ts` | S1 | `To do` |
| S9 | Activity query with filters and search | `features/dashboard/api/notifications.ts` | W0 | `Done` 2026-10-30, see git log (D4) |

### Koblip number (default sender)

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| K1 | Platform connection: Koblip's admin connects Koblip's own Chat workspace once in the admin area; Book keeps it apart from business connections | `app/(admin)/`, `features/admin/`, `lib/db/schema.ts` (+ migration), `features/dashboard/api/chat-oauth.ts` | W0 | `To do` |
| K2 | Koblip's ready-made templates: the admin reviews them, then submits them to Meta in Koblip's workspace; status shown in the admin area | `features/admin/`, `features/dashboard/api/chat-templates.ts` | K1, S1 | `To do` |
| K3 | Sender picks the number: the business's own when connected and approved, else Koblip's; each row records its sender | `notification-sender.ts` | K1 | `To do` |
| K4 | Business page: "Sending from Koblip" or "Sending from your number"; on Koblip's number the messages are read-only with on/off, plus "Use your own number" | `whatsapp-*.tsx`, `message-editor.tsx` | P1, K3 | `To do` |
| K5 | Booking forms ask for WhatsApp consent whenever either number can send | `lib/whatsapp-offer.ts` | K3 | `To do` |
| K6 | Limit and count of Koblip-number messages per business (D3); the limit is an A0 rule with a per-business override | `notification-sender.ts` | K3, A0 | `To do` |

### Admin dashboard: WhatsApp

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| A0 | Rules move from code to the database: `NOTIFICATION_RULES` becomes the code defaults, the admin's values override them; plus the admin change log | `lib/notification-rules.ts`, new `lib/platform-settings.ts`, `lib/db/schema.ts` (+ migration) | W0 | `To do` |
| A1 | Admin section frame: "WhatsApp" in the admin menu with its parts (list on phone, tabs on computer), English and Spanish | `app/(admin)/admin/whatsapp/`, `features/admin/components/whatsapp-*.tsx`, `features/admin/components/admin-shell.tsx`, `features/admin/i18n/` | W0 | `To do` |
| A2 | Overview: timer last run, waiting and failed counts, Chat reachable, each secret set or not | `features/admin/api/whatsapp-*.ts`, `whatsapp-overview.tsx`; timer heartbeat in `notification-timer.ts` | A1 | `To do` |
| A3 | Koblip number and Koblip messages screens (the admin side of K1 and K2) | `whatsapp-koblip-*.tsx` | A1, K1, K2 | `To do` |
| A4 | Businesses: every business's sender, connection, number, settings, wording, templates; open one to change, reset, turn off or disconnect | `whatsapp-businesses.tsx`, `whatsapp-business.tsx`, admin actions | A1 | `To do` |
| A5 | Activity for all businesses: filters, search, send again, cancel a waiting message | `whatsapp-activity.tsx`, admin queries and actions | A1, S9 | `To do` |
| A6 | 24-hour window: who wrote to which number and when; remove an entry | `whatsapp-window.tsx`, admin queries and actions | A1 | `To do` |
| A7 | Rules editor (A0's values, each with its default and a reset) and the change log | `whatsapp-rules.tsx`, `whatsapp-changes.tsx` | A0, A1 | `To do` |
| A8 | Usage: messages from Koblip's number per business per month, and the limit (D3), changeable for everyone or one business | `whatsapp-usage.tsx` | A1, K6 | `To do` |

### Book page

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| P1 | Page frame: the six parts (tabs on computer, list on phone), professional names, English and Spanish, built on today's data | `app/(owner)/dashboard/[businessId]/whatsapp/`, `features/dashboard/components/whatsapp-*.tsx`, `features/dashboard/i18n/{en,es}/whatsapp.ts` | W0 | `Working on` Dev 4, 2026-10-30 |
| P2 | Overview: status, setup checklist, test send | `whatsapp-overview.tsx` | P1, S8 | `To do` |
| P3 | Message editor v2: buttons, preview with buttons, Meta status and reason, "Submit to Meta" | `message-editor.tsx` | P1, S1 | `To do` |
| P4 | Your alerts screen | `whatsapp-alerts.tsx` | P1, S5 | `To do` |
| P5 | Timing screen with the 24-hour setting | `whatsapp-timing.tsx` | P1, S4 | `To do` |
| P6 | Replies screen | `whatsapp-replies.tsx` | P1, S3 | `To do` |
| P7 | Activity screen: filters, search, send again | `whatsapp-activity.tsx` | P1, S9 | `To do` |

### Booking changes and finish

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| B1 | "Move booking" for the owner, which sends Booking changed | `features/dashboard/components/booking-*`, `features/dashboard/api/booking-actions.ts` | — | `Working on` Dev 3, 2026-10-30 |
| F1 | Docs updated, live end-to-end test on a real number (book, reminder, tap each button, 24-hour normal message) | `docs/koblip-chat-integration.md` | all | `To do` |

## Done before this plan

| What | Commit |
| --- | --- |
| Connect with Koblip Chat (popup, consent, tokens, events) | Book d7fd076, Chat 1a2cc89 |
| WhatsApp page v1, wording editor, reminders, quiet hours, owner number | fcd265a |
| Sending engine, timer, opt-in on booking forms, delivery status, history | da6b22b |
| Wording long enough for Meta; lost templates copied back from Meta | 89f40a9, Chat 7326f7a |
| Workspace dropdown on Chat's consent page | Chat 66bb978 |
