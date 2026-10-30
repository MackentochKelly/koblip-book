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
| 3. Replies, activity, bookings | Dev 3 | `chat-events.ts`, `notification-replies.ts`, `booking-actions.ts`, booking components | S3, S9, S7, B1, A6, A5 |
| 4. Business page | Dev 4 | `app/(owner)/dashboard/[businessId]/whatsapp/`, `features/dashboard/components/whatsapp-*.tsx`, `message-editor.tsx`, `features/dashboard/i18n/*/whatsapp.ts` | P1, P5, P6, P7, P3, P2, P4, K4 |
| 5. Admin dashboard | Dev 1 | `app/(admin)/admin/whatsapp/`, `features/admin/` | A1, A2, A4, A7, A3, A8 |
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
| D5 | Moving a booking (B1): `bookings.moves` counts the owner's moves, and each `notification_sends` row records the booking's `moves` when it was made. "Once" means once per booking, message, reminder time and move (migration 0020 replaces 0018's `visit_at`). A move sets the booking's waiting reminders and "changed" message to skipped (`moved`), and a waiting confirmation to the new `moves` (it goes with the new time). The sender then queues "Booking changed" at the new `moves` only when the newest sent "confirmed" or "changed" row has a lower `moves`, and plans reminders for the new time (Dev 2, in `plan()`). The move action lives in `features/booking/api/move-owner-booking.ts`, next to `createOwnerBooking`, and the page passes it in. A move keeps the same person and length. | Without a per-move key, a second move could not send a second "changed" message and a reminder already sent would block the new one. A visit time fails when a booking goes A→B→A→B, a counter never does. The opening-hours and busy checks live in `features/booking`, which `features/dashboard` may not import. | Dev 3 with Dev 2, 2026-10-30 |
| D6 | C1: Chat's inbound app event gets `button: { payload, title }` (null when no button was tapped). The payload is the one set when the message was sent; `replyToMessageId` is the provider ID of the message that carried the button, so Book can match a tap to the send it answers. Template quick replies and normal-message buttons arrive the same way. Sales gets the same field and ignores it. | A general API field any app can use; Chat already stored the tap, it just did not forward it. | Dev 1, 2026-10-30 |
| D7 | Book's buttons: Reminder and Booking changed carry "I'll be there" / "Can't make it" (`confirm`, `cantCome`); Booking confirmed, Booking cancelled and the owner's alerts carry none. An owner may use `confirm`, `cantCome` or `ok` on Confirmed, Reminder and Changed, only `ok` on Cancelled, none on alerts. Each button is a quick reply whose payload is its action. | The goals ask for answers on reminders; a moved time needs the same answer; a confirmation the customer just made and a cancellation need none, and fewer buttons keep Meta's review simple. | Dev 2, 2026-10-30 |
| D8 | Drafts stay in Book: saving wording or buttons changes only Book. "Submit to Meta" creates the template in Chat (`save_as_draft: false`) or edits Chat's copy (`PUT`), after copying back one Meta has but Chat lost. Book keeps what was submitted (`chat_templates.submitted`), sends the approved template with exactly that copy's fields, and shows a newer wording as `draft`. Opening Integrations or the sender only reads status and reason (`refreshChatTemplates`), never creates. | Chat's `POST /api/template/:id/publish` is not open to apps, so a Chat draft could not be submitted through the public API; this needs nothing new from Chat. Sending the submitted copy keeps `{{1}}…` in the order Meta approved even after the owner edits. | Dev 2, 2026-10-30 |
| D9 | C2: Chat's send API takes `buttonHeader` and `buttonFooter` (text, up to 60 characters each) next to `buttonParams` on an `interactive` / `button` message. An image header replaces the text title (WhatsApp allows one header). Both are saved on the message's `interactive_data`. | Named like `buttonParams`, so the request stays flat and any app can use it; the same limits Meta documents. | Dev 1, 2026-10-30 |
| D10 | Each part of the business page is its own route under `whatsapp/` (`messages`, `alerts`, `timing`, `replies`, `activity`); Overview is `whatsapp/` itself. On a phone `whatsapp/` shows Overview with the list of the other parts under it; on a computer, tabs. One shared frame (`whatsapp-frame.tsx`, from the route's `layout.tsx`). | Every part gets its own link, Back works on a phone, and each P task owns one route and one component file. | Dev 4, 2026-10-30 |
| D11 | K1: Koblip's own Chat connection is its own one-row table, `koblip_chat_connection` (id `koblip`), never a business's `chat_connections` row. It uses the same OAuth flow and callback (the sealed attempt says which account), started at `/api/chat/connect/koblip` by an admin only. Code calls `koblipChatApi(path)` next to `chatApi(businessId, path)`. Until A3 builds the Koblip number screen, Connect / Disconnect sits on the admin Overview as a card that A3 can move. The Chat window's shared types moved to `types/chat-connect.ts`, so the admin feature uses them without importing the dashboard feature. | No business can reach Koblip's tokens, one flow to keep secure, and the import rules hold. | Dev 1, 2026-10-30 |
| D12 | After a move (D5), `plan()` makes one "changed" row at the booking's current `moves`; it is also the mark that the move was planned. It goes when a confirmation was sent before this move (`confirmed.moves < bookings.moves`); else it is skipped as `notTold`, since the confirmation, if still waiting, carries the new time. Reminders are planned again for the new time from the moment of the move, when the customer agreed and has a phone. Skipped rows show the reasons `moved` and `notTold` on Activity. | One row per move keeps "once" true for A→B→A; telling a customer of a change to a booking they never heard of would confuse them. | Dev 2, 2026-10-30 |
| D13 | A0: `NOTIFICATION_RULES` stays the code defaults; `notificationRules(businessId?)` in `lib/platform-settings.ts` returns them with the admin's values (`platform_settings`) and, for rules in `BUSINESS_RULE_KEYS`, the business's own (`business_settings`) on top. `setNotificationRule` saves a value or resets it (null), checked against `NOTIFICATION_RULE_CHECKS` (never past Meta's limits), and logs before and after in `platform_setting_changes`; the caller (A7) checks the admin. A stored value a rule no longer allows falls back to the default. D3's limit is the rule `koblipMonthlyTemplates` (300), the only per-business rule for now. Each lane switches its own reads from `NOTIFICATION_RULES` to `notificationRules()` in its files; client components get the values from their page. | Rules change without a release, no admin value can break a send, and every change says who and when. Lanes keep their own files. | Dev 1, 2026-10-30 |
| D14 | Activity (P7): the filters live in the address (`?message=&state=&q=`), read and written by `features/dashboard/utils/activity-filter.ts` (shared by the page and the screen); search runs on Enter, not on every key. | A filtered list can be shared and Back brings it back; one server query per search, and no new shared debounce hook. | Dev 4, 2026-10-30 |
| D15 | S4: inside the 24-hour window, and only when the owner left the 24-hour setting on, a message goes as a normal message: with its buttons as an `interactive` / `button` message (C2: title, body, footer, buttons) when it has buttons, else as plain text. A normal message's button title is limited to 20 characters (a template's to 25); when one is longer, the approved template goes instead, or the words alone when there is none. `saveNotificationSettings` takes the three new settings as optional, leaving each as it is when not given. The sender only claims the messages it knows (`BOOKING_MESSAGES`); other kinds (S3's thank-you and alerts) wait as pending until S5. The sender, timer and settings defaults read `notificationRules()`; the timer re-reads `sendEverySeconds` before each wait. | The customer can answer in the window at no cost; a button is never cut short; today's page keeps working; an admin change takes effect without a restart. | Dev 2, 2026-10-30 |
| D16 | Replies (S3): Chat's status events give WhatsApp's id of each message Book sent, saved as `notification_sends.chat_message_id`; a tap's `replyToMessageId` finds the send by it, through the workspace it went from (the business's for `own`, Koblip's for `koblip`). A tap only replaces an older one, so repeats and late events change nothing. It acts on the booking only when it answers the booking as it stands (same `moves`, still confirmed, not started). "Can't make it" then cancels or only alerts per the owner's setting (D2). Book queues rows for the sender: `ownerCantCome` or `ownerCancelled` to the owner (skipped `noOwnerPhone` without a number) and `thankYou` to the customer when the thank-you is on, once per booking and move. The sender claims only the kinds it can send yet (Dev 2), and S5 sends these three. Contract change: Activity's `message` is `SendKind`, the booking messages plus these three. | Chat's tap names WhatsApp's id, not Chat's record id; status events carry both. A tap on a message from before a move must not cancel the new time. Every message stays a row, so Activity shows each answer and what it caused. | Dev 3 with Dev 2, 2026-10-30 |
| D17 | S8: `sendTestToMyPhone(businessId, message)` sends that message now to the owner's WhatsApp, in the owner's language, with Meta's sample values and the business's real name; it goes the same way a real one would (normal message in the window, else the approved template). It is not a booking's message, so it has no row and no Activity entry; it returns `{ ok: true }` or `{ ok: false, error }` with the Activity reasons (`noOwnerPhone`, `notConnected`, `templateNotApproved`, `badPhone`, `unsubscribed`, a Chat code, or `chat`). `sendAgain(businessId, sendId)` puts a `failed` row back to `pending`, due now, and the next check sends it; it refuses with `notFailed`, `cancelled`, `late` or `not_found`. | The owner sees exactly what customers get without a booking; "Send again" keeps one row per message, so the once-only rule and Activity stay true. | Dev 2, 2026-10-30 |
| D18 | Opt-out (S7) stays in Koblip Chat, which already keeps it per workspace: a customer who writes one of the account's opt-out words (Chat's setting, `STOP` by default, any case) is marked `is_unsubscribed` on that workspace's contact and gets Chat's confirmation; `START`, or any other message, signs them back up. Book keeps no list of its own: before every send the sender asks Chat for the contact (`find-or-create`) and skips an opted-out one as `unsubscribed` ("Customer opted out" on Activity), so waiting reminders stop too. `BAJA` is an opt-out word wherever the account adds it in Chat's settings: Koblip's admin for Koblip's number, the owner for their own. No sender call or migration is added. | One source of truth, the one WhatsApp contacts live in: a second list in Book could not see a customer sign back up, and Chat's inbound event carries no message text. Opting out of one number stops that number only, as WhatsApp expects. Changing Chat's default words for every account is Chat's choice, not Book's. | Dev 3, 2026-10-30 |
| D19 | One shared frame for a page made of parts: `components/section-parts.tsx` (`SectionParts`: title, parts with id, label, link and icon, the open part, an optional `notice` line). Tabs on a computer; on a phone the first part with a list of the others, each part its own screen with Back. The admin's WhatsApp frame uses it (A1). Lane 4 switches `features/dashboard/components/whatsapp-frame.tsx` to it (keeping its connect screen and refresh), so both look and behave the same: Dev 4's follow-up, asked through the head developer. | The plan asks for the same shared parts on the business page and in the admin; one part, never two copies. Lane 5 does not edit lane 4's files. | Dev 1, 2026-10-30 |
| D20 | S6: four more fields, `{teamMember}`, `{duration}`, `{price}`, `{address}` (owners see them as staff, duration, price, address / profesional, duracion, precio, direccion). The customer's messages may use all four; the owner's alert all but the address. `bookingValues()` in `booking-templates.ts` fills every field in the reader's language: no team member reads "our team", no price "to be confirmed", a zero price "free", no address the business's name. Book's default wording stays as it is. No manage-booking link: no manage page exists yet. The four labels went into lane 4's `whatsapp.ts` (en, es), as the editor's field buttons need them. | Meta refuses an empty value, and a dash would read badly to a customer; one helper keeps real sends and tests the same. Leaving the defaults alone keeps them short and Meta's review simple; the owner adds a field with one tap. | Dev 2, 2026-10-30 |
| D21 | A2: the timer writes its last check (time and short error) to a one-row table, `notification_timer` (migration 0024), after every check. Overview calls it stopped when that check is older than 3 of its waits (`sendEverySeconds`), counts waiting (pending or sending) and failed in the last 7 days, leaving demo copies out. "Koblip Chat reachable" means its API address answers at all within 5 seconds (Chat has no health route; whether Koblip's sign-in works shows on Koblip number). Server settings show only set or missing. These numbers and the settings' names live in `lib/whatsapp-admin-rules.ts`. Each admin WhatsApp part has a `loading.tsx` (rows skeleton). | A row in the database outlives a restart and works with more than one server process; no change to Chat needed; values someone may change live in one rules file. | Dev 1, 2026-10-30 |
| D22 | K3: the number is chosen per business at each send. The business's own number when its connection works, has a number, and Meta approved its own copy of every message it has on, in both languages; else Koblip's number with Koblip's ready-made set (`koblip_<message>_v2`, Book's default wording, kept in the new `koblip_chat_templates`, filled by K2); else its own number as it stands. Koblip's number serves only businesses with an owner and never a demo. Bookings get messages when made after the first number the business could send from was connected. Each row's `sender` is written with the outcome, together with Chat's record id. The 24-hour window is per number: a customer who wrote to Koblip's number gets normal messages from it. | Half-approved own templates would fail sends that Koblip's number can make; whole-business choice keeps one number per customer while the business sets up. A business nobody owns cannot see or stop what goes in its name. Writing `sender` with the record id lets status events and taps find the send through the right workspace (D16). | Dev 2, 2026-10-30 |
| D23 | Overview's setup checklist (P2) is worked out from what Book already keeps, by `features/dashboard/utils/setup-steps.ts`, over the turned-on messages in both languages: Connected = a usable Chat connection with a WhatsApp number; Wording checked = each text is the owner's own or was already submitted (Book's untouched, never-submitted wording is not checked); Submitted = none is a draft; Approved = all approved by Meta; Live = approved with a customer message on. Each step needs the one before. Only the first open step shows what to do and a link to where. The test send defaults to the Reminder (it has the buttons) and needs the owner's WhatsApp. `isCustomerMessage` moved to `utils/customer-messages.ts` so the util and the screens share it. | No new column or migration: every step reads data that exists; a step that could be done before the one above it would mislead. | Dev 4, 2026-10-30 |
| D24 | S5: Customer can't come (`ownerCantCome`), Customer cancelled (`ownerCancelled`) and Message failed (`ownerFailed`) are booking messages like New booking: their own templates (`koblip_book_owner_cant_come_v2`, `koblip_book_owner_cancelled_v2`, `koblip_book_owner_message_failed_v2`; in Koblip's set `koblip_owner_cant_come_v2`, `koblip_owner_cancelled_v2`, `koblip_owner_message_failed_v2`), no buttons, New booking's fields (D20), in the owner's language, each on or off and editable on Your alerts. The sender plans Message failed once per booking and move, when a message to the customer (not an alert, not the thank-you) failed and the visit is still ahead. The thank-you (`thankYou`) is a fixed short text in the customer's language with the business's name, sent only as a normal message inside the 24-hour window (else skipped as `windowClosed`), never as a template, whatever the 24-hour setting; the thank-you setting turns it on or off. A cancelled booking still sends `cancelled`, `ownerCancelled` and `thankYou`. Contract change: `BookingMessage` gains the three alerts and `SendKind` is `BookingMessage \| "thankYou"` (no migration: SQLite keeps these enums in TypeScript only). With K3 (D22) a business's own number sends only when these alerts too are approved or turned off; the thank-you goes from the number K3 picks, while the customer's window with it is open. The alerts' names and the `windowClosed` reason were added to lane 4's i18n files. | The alerts need Meta's approval like New booking, so they share its editor, "Submit to Meta" and once-only rows; one failure alert per booking and move tells the owner without a flood. A template thank-you would cost a paid message and a Meta review for a courtesy, and the tap has just opened the window. | Dev 3, 2026-10-30 |
| D25 | A4: Businesses lists every real business with the number it sends from (its own workspace, else Koblip's) and how many messages are off; one business (`businesses/[businessId]`) shows its connection, each message with its wording (own or Book's) and Meta's review per language, and its settings. The admin can turn a message on or off, reset one message's wording (both languages), reset the settings (reminders, quiet hours, 24-hour, "Can't make it", thank-you; the owner's number, language and on/off stay), turn every message off, or disconnect its own workspace (`disconnectBusinessChat`, with the Chat code, passed in by the page). Editing wording stays the owner's. Each change goes in the same change log as the rules (`adminChangeEntry` in `lib/platform-settings.ts`, keys `whatsapp.turnedOff`, `whatsapp.settings`, `whatsapp.wording.<message>`, `whatsapp.connection`, with the business), saved with the change. The page reads with the business page's own queries after the admin check; admin components take plain prop types. The number itself shows once K3 / P2 know it (Chat gives Book only its id). New shared parts: `components/confirm-dialog.tsx` (asks first, the caller's words) and a `back` link on `SectionParts`. | Nothing hidden, one change log, no logic copied across features; the admin fixes or stops a business without taking its wording over. | Dev 1, 2026-10-30 |

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
| C2 | Send API: a normal message with reply buttons can have a text title and footer | `controllers/unified-whatsapp.controller.js`, its service, tests, docs | — | `Done` 2026-10-30, Chat 8694007 |

### Book server

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| S1 | Templates with buttons; nothing created or submitted automatically; "Submit to Meta" action per message and language; Meta's reason kept and shown; buttons, review and reason filled in `notificationMessagesFor` | `features/dashboard/utils/booking-templates.ts`, `features/dashboard/api/chat-templates.ts`, `notification-actions.ts`, `notifications.ts` (+ `drizzle/0019`) | W0 | `Done` 2026-10-30, see git log |
| S2 | Remove the 10 waiting templates (D1) and move to the `_v2` names | `features/dashboard/api/chat-templates.ts`, a one-off script in `scripts/` | S1 | `Blocked`: code on main (Dev 2, see git log); the deletion runs on the live server and waits for the owner's deploy go-ahead |
| S3 | Replies: a button tap finds the message by Chat's record id (works for both numbers), saves the reply, confirms or cancels the booking per the owner's setting (D2), queues the owner's alert, sends the thank-you | `features/dashboard/api/chat-events.ts`, new `features/dashboard/api/notification-replies.ts` | W0, C1 | `Done` 2026-10-30, see git log (D16; the alert and thank-you go with S5) |
| S4 | The 24-hour setting in the sender; inside the window send a normal message with buttons; `saveNotificationSettings` takes the three new settings (24-hour, "Can't make it", thank-you) | `notification-sender.ts`, `notification-actions.ts` | W0, C2 | `Done` 2026-10-30, see git log |
| S5 | Owner alerts: Customer can't come, Customer cancelled, Message failed | `features/dashboard/api/notification-sender.ts`, `booking-templates.ts` | S1, S3 | `Done` 2026-10-30, see git log (D24) |
| S6 | More fields: team member, price, address, duration (and a manage-booking link once a manage page exists) | `booking-templates.ts`, `notification-sender.ts` | W0 | `Done` 2026-10-30, see git log (D20; the manage link waits for a manage page) |
| S7 | Opt-out: a customer who writes STOP (or BAJA) gets no more messages; the sender asks `notification-replies.ts` whether a number opted out | `chat-events.ts`, `notification-replies.ts` (one call added in the sender by lane 2) | S3 | `Done` 2026-10-30 by D18: Chat already keeps the opt-out and the sender already asks it before every send; no Book code |
| S8 | Test send to the owner's phone; "Send again" for a failed message | `notification-actions.ts`, `notification-sender.ts` | S1 | `Done` 2026-10-30, see git log |
| S9 | Activity query with filters and search | `features/dashboard/api/notifications.ts` | W0 | `Done` 2026-10-30, see git log (D4) |

### Koblip number (default sender)

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| K1 | Platform connection: Koblip's admin connects Koblip's own Chat workspace once in the admin area; Book keeps it apart from business connections | `app/(admin)/`, `features/admin/`, `lib/db/schema.ts` (+ migration), `features/dashboard/api/chat-oauth.ts` | W0 | `Done` 2026-10-30, see git log (K1) |
| K2 | Koblip's ready-made templates: the admin reviews them, then submits them to Meta in Koblip's workspace; status shown in the admin area | `features/admin/`, `features/dashboard/api/chat-templates.ts` | K1, S1 | `Working on` Dev 2, 2026-10-30 |
| K3 | Sender picks the number: the business's own when connected and approved, else Koblip's; each row records its sender | `notification-sender.ts` | K1 | `Done` 2026-10-30, see git log (D22; `drizzle/0025`) |
| K4 | Business page: "Sending from Koblip" or "Sending from your number"; on Koblip's number the messages are read-only with on/off, plus "Use your own number" | `whatsapp-*.tsx`, `message-editor.tsx` | P1, K3 | `To do` |
| K5 | Booking forms ask for WhatsApp consent whenever either number can send | `lib/whatsapp-offer.ts` | K3 | `To do` |
| K6 | Limit and count of Koblip-number messages per business (D3); the limit is an A0 rule with a per-business override | `notification-sender.ts` | K3, A0 | `To do` |

### Admin dashboard: WhatsApp

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| A0 | Rules move from code to the database: `NOTIFICATION_RULES` becomes the code defaults, the admin's values override them; plus the admin change log | `lib/notification-rules.ts`, new `lib/platform-settings.ts`, `lib/db/schema.ts` (+ migration) | W0 | `Done` 2026-10-30, see git log (A0) |
| A1 | Admin section frame: "WhatsApp" in the admin menu with its parts (list on phone, tabs on computer), English and Spanish | `app/(admin)/admin/whatsapp/`, `features/admin/components/whatsapp-*.tsx`, `features/admin/components/admin-shell.tsx`, `features/admin/i18n/` | W0 | `Done` 2026-10-30, see git log (A1, D19) |
| A2 | Overview: timer last run, waiting and failed counts, Chat reachable, each secret set or not | `features/admin/api/whatsapp-*.ts`, `whatsapp-overview.tsx`; timer heartbeat in `notification-timer.ts` | A1 | `Done` 2026-10-30, see git log (A2, D21) |
| A3 | Koblip number and Koblip messages screens (the admin side of K1 and K2) | `whatsapp-koblip-*.tsx` | A1, K1, K2 | `To do` |
| A4 | Businesses: every business's sender, connection, number, settings, wording, templates; open one to change, reset, turn off or disconnect | `whatsapp-businesses.tsx`, `whatsapp-business.tsx`, admin actions | A1 | `Done` 2026-10-30, see git log (A4, D25) |
| A5 | Activity for all businesses: filters, search, send again, cancel a waiting message | `whatsapp-activity.tsx`, admin queries and actions | A1, S9 | `To do` |
| A6 | 24-hour window: who wrote to which number and when; remove an entry | `whatsapp-window.tsx`, admin queries and actions | A1 | `Working on` Dev 3, 2026-10-30 |
| A7 | Rules editor (A0's values, each with its default and a reset) and the change log | `whatsapp-rules.tsx`, `whatsapp-changes.tsx` | A0, A1 | `Working on` Dev 1, 2026-10-30 |
| A8 | Usage: messages from Koblip's number per business per month, and the limit (D3), changeable for everyone or one business | `whatsapp-usage.tsx` | A1, K6 | `To do` |

### Book page

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| P1 | Page frame: the six parts (tabs on computer, list on phone), professional names, English and Spanish, built on today's data | `app/(owner)/dashboard/[businessId]/whatsapp/`, `features/dashboard/components/whatsapp-*.tsx`, `features/dashboard/i18n/{en,es}/whatsapp.ts` | W0 | `Done` 2026-10-30, see git log |
| P2 | Overview: status, setup checklist, test send | `whatsapp-overview.tsx` | P1, S8 | `Done` 2026-10-30, see git log (P2, D23) |
| P3 | Message editor v2: buttons, preview with buttons, Meta status and reason, "Submit to Meta" | `message-editor.tsx` | P1, S1 | `Done` 2026-10-30, see git log (P3) |
| P4 | Your alerts screen | `whatsapp-alerts.tsx` | P1, S5 | `To do` |
| P5 | Timing screen with the 24-hour setting | `whatsapp-timing.tsx` | P1, S4 | `Done` 2026-10-30, see git log (P5) |
| P6 | Replies screen | `whatsapp-replies.tsx` | P1, S3 | `Done` 2026-10-30, see git log (P6) |
| P7 | Activity screen: filters, search, send again | `whatsapp-activity.tsx` | P1, S9 | `Done` 2026-10-30, see git log (P7, D14) |

### Booking changes and finish

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| B1 | "Move booking" for the owner, which sends Booking changed | `features/dashboard/components/booking-*`, `features/dashboard/api/booking-actions.ts` | — | `Done` 2026-10-30, see git log (move by Dev 3, sending by Dev 2, D5 and D12) |
| F1 | Docs updated, live end-to-end test on a real number (book, reminder, tap each button, 24-hour normal message) | `docs/koblip-chat-integration.md` | all | `To do` |

## Done before this plan

| What | Commit |
| --- | --- |
| Connect with Koblip Chat (popup, consent, tokens, events) | Book d7fd076, Chat 1a2cc89 |
| WhatsApp page v1, wording editor, reminders, quiet hours, owner number | fcd265a |
| Sending engine, timer, opt-in on booking forms, delivery status, history | da6b22b |
| Wording long enough for Meta; lost templates copied back from Meta | 89f40a9, Chat 7326f7a |
| Workspace dropdown on Chat's consent page | Chat 66bb978 |
