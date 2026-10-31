# Koblip Chat integration

Koblip Chat (the Wapi repositories, API at `https://api.koblip.com`) holds the official WhatsApp connections. Koblip Book uses it only through Chat's public API, like any other company's app: Book never holds Meta credentials, and a change Book needs in Chat is a general API feature, never a Book-only one.

Status: built on both sides and tested on this Mac; not yet live. The live test and the removal of the first templates (S2) wait for the owner's deploy go-ahead. Plan, tasks and every decision (D1…): [WhatsApp notifications v2](plans/whatsapp-notifications.md).

Settings: the `CHAT_*` and `TOKEN_ENCRYPTION_KEY` lines in `.env.example` (server only). Chat's side: `wapi-api` `docs/api/oauth.md`; Book's callback URL must be registered there exactly.

## Two numbers

| | Koblip's number (default) | The business's own number |
| --- | --- | --- |
| When | Every business with an owner (never a demo), with no setup, once Koblip's admin has connected Koblip's workspace | After the owner connects their own Koblip Chat workspace and Meta approves their messages |
| Templates | Koblip's ready-made set (`koblip_<message>_v2`), submitted once by Koblip's admin | The business's own copies (`koblip_book_<message>_v2`) in its own wording |
| The owner can | Turn each message on or off | Also edit wording and buttons, and submit to Meta |
| 24-hour normal messages | If the customer wrote to Koblip's number | If the customer wrote to the business's number |
| Limit | 300 template messages per business per calendar month (UTC), changeable by the admin (D3, D29) | None |

The sender picks the number at each send (`lineFor` in `features/dashboard/api/notification-sender.ts`, D22, D35): the business's own when its connection works, has a number, and Meta approved every message it has on in both languages, or, before that, when the person's 24-hour window with the own number is open and a normal message may go (the 24-hour setting on; the thank-you always); else Koblip's; else its own as it stands. Each sent row records its `sender`. The Automations page and the admin show the choice by approval alone (`senderFor`, D26); the Overview's line says those who wrote to the own number already get messages from it (D34, D35). Booking forms ask for WhatsApp consent, unticked, whenever either number can send (`lib/whatsapp-offer.ts`).

## Step 1: Connect with a popup (built)

The person taps Connect, a Koblip Chat window opens, they log in, choose a workspace if they have more than one, and tap Allow. The window closes and Book shows Connected. This is OAuth 2.0 authorization code with PKCE.

- A business: Integrations → Connect (`app/api/chat/connect`), stored in `chat_connections`.
- Koblip's own workspace: admin → WhatsApp → Koblip number → Connect (`app/api/chat/connect/koblip`, admins only), stored in its own one-row table `koblip_chat_connection`, never reachable by a business (D11).
- Both use the same callback (`app/api/chat/callback`, which checks `state` and swaps the code) and `features/dashboard/api/chat-oauth.ts`: tokens sealed with `TOKEN_ENCRYPTION_KEY`, refreshed before they expire, "Connect again" when a refresh fails, Disconnect revokes at Chat and then forgets here. Code calls `chatApi(businessId, path)` or `koblipChatApi(path)`.
- Scopes: `contacts`, `templates`, `automations`, `conversations`. A connection made before `templates` existed must connect again.

## Step 2: What Chat gives Book (built, `wapi-api`)

- `POST /api/contacts/find-or-create` `{ phone_number, name }`; its `is_unsubscribed` is Chat's opt-out (D18): a customer who writes the account's opt-out word (`STOP` by default; add `BAJA` in Chat's settings) gets nothing more from that number.
- `GET /api/whatsapp/connections`: the workspace's numbers. Book sends from the oldest active one, the same default Chat uses, and saves it on the connection.
- Templates: `GET /api/template`, `POST /api/template/create` (`save_as_draft: false`), `PUT /api/template/:id` (Chat sends it back to Meta), `POST /api/template/sync-status` (Meta's status and reason), `GET /api/template/meta-list` and `POST /api/template/sync` (copy back one Meta has but Chat lost).
- `POST /api/whatsapp/send`: a `template` with `templateVariables`, plain `text`, or an `interactive` / `button` message with `buttonParams` and, since C2, a text `buttonHeader` and `buttonFooter` (up to 60 characters, D9). Chat does not check the 24-hour window itself; Book does.
- Signed events to `app/api/chat/events` (`CHAT_EVENTS_SECRET`): a customer's message (since C1 with `button: { payload, title }` when they tapped one, D6), and each message's delivery status with WhatsApp's id of it.

## Step 3: Booking messages (built)

### Messages

| Message | To | When | Buttons (default) |
| --- | --- | --- | --- |
| Booking confirmed | Customer | Right after booking | None |
| Reminder | Customer | Before the visit, at the reminder times | I'll be there / Can't make it |
| Booking changed | Customer | When the owner moves the booking, if the customer was told of it | I'll be there / Can't make it |
| Booking cancelled | Customer | When it is cancelled, if the customer got the confirmation | None |
| New booking | Owner's WhatsApp | A customer booked online | None |
| Customer can't come | Owner's WhatsApp | The customer tapped "Can't make it" | None |
| Customer cancelled | Owner's WhatsApp | The tap cancelled the booking | None |
| Message failed | Owner's WhatsApp | A message to the customer failed and the visit is still ahead (once per booking and move) | None |
| Thank-you | Customer | After a tap, only as a normal message inside the 24-hour window, if on | — |

Customer messages go in the language the customer booked in; alerts in the owner's. One wording for every kind of business, with the business's name in each customer message. Fields: name, service, business, date, time, team member, duration, price, address (customer messages) or phone (alerts, not address) (D20). A missing value reads naturally ("our team", "to be confirmed", "free", the business's name).

Wording and buttons live in `features/dashboard/utils/booking-templates.ts`. An owner may use "I'll be there", "Can't make it" or "OK" on Confirmed, Reminder and Changed, only "OK" on Cancelled, none on alerts (D7). Each button is a quick reply whose payload is its action.

### Nothing goes to Meta on its own

Saving wording or buttons changes only Book (D8). "Submit to Meta" (per message and language) creates or edits the template in Chat; Book keeps what was submitted and sends exactly that copy once approved, so a newer wording shows as "Not submitted". Opening a page only reads Meta's status and reason. Koblip's set is submitted the same way by the admin (K2, D30).

### When reminders go

Counted from when the customer booked to when the visit starts (default times 24 hours, 2 hours, 30 minutes; the owner picks up to 3):

| Booked ahead | Customer gets |
| --- | --- |
| More than 24 hours | Confirmation now, reminder 24 hours before, reminder 30 minutes before |
| 3 to 24 hours | Confirmation now, reminder 2 hours before, reminder 30 minutes before |
| 1 to 3 hours | Confirmation now, reminder 30 minutes before |
| Less than 1 hour | Confirmation only |

- Quiet hours (default 9 pm to 8 am, business's time zone, owner's choice): a reminder of 2 hours or more that would land then goes an hour before quiet hours start, the evening before; a shorter one is skipped.
- A reminder needs as much time again as itself, up to an hour, before it.
- A move skips the old reminders and plans new ones for the new time (D5, D12).
- Why: a 24-hour reminder has the best evidence ([study](https://acofp.org/news-and-publications/journal/article-detail/vol-12-no-5-(2020)-september-october-2020/evaluation-clinical-no-show-rates-setting-outpatient-internal-medicine-residency-clinic)); earlier bookings need earlier reminders ([paper](https://ideas.repec.org/a/taf/tjorxx/v69y2018i11p1863-1875.html)); Fresha and Square work the same way ([Fresha](https://www.fresha.com/blog/making-the-most-of-freshas-notifications), [Square](https://square.com/gb/en/appointments/features/reminders)).

### The 24-hour setting (Meta's rule)

A customer's message opens a 24-hour window with that number; another resets it. Inside it any message may go; outside it only an approved template ([Meta: send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)). Book keeps each customer's last message per workspace and number (`chat_replies`) and uses the window less a 10-minute margin (`freeTextMinutes`).

With the owner's 24-hour setting on (the default), a message inside the window goes as a normal message, free: with its buttons as an `interactive` message (title, text, footer, buttons) when every button title fits WhatsApp's 20 characters, else as the approved template, or as plain text when there is none (D15). With it off, the template always goes. Normal messages never count toward Koblip's monthly limit.

### Replies

A tap arrives as Chat's event; Book finds the message it answers by WhatsApp's id, through the workspace it went from, and saves the answer on it (`features/dashboard/api/notification-replies.ts`, D16). It acts only when it answers the booking as it stands (same move, still confirmed, not started):

- "I'll be there": saved, shown on Activity.
- "Can't make it": alerts the owner by default; the owner can switch it to cancel and free the time on Replies (D2).
- The owner's alert and the thank-you are queued as their own messages, once per booking and move. A repeated or late tap changes nothing.

### Sending

`runNotifications` in `notification-sender.ts`, run every minute by the server's timer (`instrumentation.ts`, `notification-timer.ts`, which records each check for the admin). Each check plans rows for bookings made since the business could first send, then sends what is due: find or create the contact (skipped if opted out), then send. Every message is one row in `notification_sends` (unique per booking, message, reminder time and move), claimed before it is sent. Chat's send has no idempotency key, so a failed send is never repeated on its own; the owner or admin can press "Send again". A row left "sending" by a stopped server is marked failed. Skipped and failed rows say why (Activity's reasons: no consent, no phone, turned off, opted out, waiting for Meta, monthly limit, moved, and so on).

## Screens

Business: Notifications, `/dashboard/[businessId]/notifications` (the old `whatsapp/` and `auto-messages/` addresses redirect there, D36, D38). Phone: Overview with a list of the other parts, each its own screen with Back; computer: tabs (`components/section-parts.tsx`, D10, D19).

| Part | What the owner does there |
| --- | --- |
| Overview | One status (Live, Needs action or Waiting for Meta) with the number that sends, why Koblip's number still sends (D34, D35) and one button for the next step; the own number's setup progress (D23), folded once live; the last days' Sent, Read, Replies and Failed, each opening Activity filtered; the four customer messages with on/off and Meta's status; "Send a test to my phone", or a field for the owner's WhatsApp (D17, D36) |
| Messages | On/off and Meta's status on each; on their own number: wording and buttons in English and Spanish, preview, Meta's status and reason, "Submit to Meta". On Koblip's number: on/off only (D26) |
| Alerts | The owner's WhatsApp number and language, then each alert |
| Timing | Reminder times, quiet hours, the 24-hour setting |
| Replies | What "Can't make it" does, thank-you on/off |
| Activity | Every message: who, which, when, which number, normal or template, delivered/read, the customer's answer; filters, search by name or phone, "Send again" for failed (D4, D14); with nothing sent yet, "Send a test" |

Admin: `/admin/whatsapp` (admins only; nothing hidden, every change in the Change log; secrets show as set or missing, never their value).

| Part | What the admin does there |
| --- | --- |
| Overview | Waiting and failed counts, timer health, Chat reachable, server settings set or missing |
| Koblip number | Connect or disconnect Koblip's workspace; its numbers, quality and review, and which one sends (D31) |
| Koblip messages | Review Koblip's ready-made set in both languages and submit each to Meta (D30) |
| Businesses | Each business's number, connection, messages and settings; turn on or off, reset, turn off, disconnect (D25) |
| Activity | Every business's messages, each with its business, in that business's time zone: filters, search, send again for a failed one, cancel a waiting one (kept as skipped, "Cancelled by Koblip"); the same list and query as the owner's Activity (D33) |
| 24-hour window | Who wrote to which number and when; remove an entry (D27) |
| Rules | Every rule (reminder choices, quiet hours defaults, limits, 24-hour margin, words per field, button limits, batch size, timer) with its default; change or go back (D13, D28) |
| Usage | Template messages from Koblip's number per business this month (UTC), "At limit" once reached, and the limit for everyone or one business (D32) |
| Change log | Every admin change: what, from → to, for whom, who, when |

Rules live in `lib/notification-rules.ts` as code defaults; the admin's values (`platform_settings`) and a business's own limit (`business_settings`) override them (`notificationRules()` in `lib/platform-settings.ts`).

## Later (not started)

- WhatsApp broadcasts.
- A manage-booking link in the messages, once a manage page exists.
