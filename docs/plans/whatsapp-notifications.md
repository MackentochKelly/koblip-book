# WhatsApp notifications v2

Booking messages on WhatsApp through Koblip Chat, rebuilt so the owner sees
and controls everything, customers can answer with buttons, and nothing is
sent to Meta without the owner's OK. How Book and Chat talk is in
[Koblip Chat integration](../koblip-chat-integration.md). How to use this
file: [Plans](README.md).

Developers: **Dev A**, **Dev B**. Write your name in the task when you claim it.

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
- One wording for every kind of business (salon, clinic, gym…): no words that fit only one trade. Meta needs a copy in each business's own WhatsApp account, so each business gets its own copy of the same wording, which its owner may edit.

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

## Decisions for the owner

| ID | Question | Status |
| --- | --- | --- |
| D1 | Delete the 10 templates now waiting at Meta (no buttons, cannot be edited while waiting) and submit new ones after review? Meta blocks a deleted name for about 4 weeks, so the new ones get new names. | `Decision` |
| D2 | Default for "Can't make it": cancel the booking and free the time, or only alert the owner? | `Decision` |

## Tasks

The contract (W0) comes first; after it, the Chat track (Dev A) and the page
track (Dev B) run side by side without touching the same files.

### Contract

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| W0 | Types and settings shape for everything below: message buttons, reply actions, the 24-hour setting, alerts, activity rows, fields. UI and server both build against it. | `features/dashboard/types/notifications.ts`, `lib/notification-rules.ts` | — | `Working on` Dev A, 2026-10-30 |

### Chat API (`Wapi/wapi-api`, general features only)

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| C1 | Inbound app events carry the tapped button's payload and title | `services/koblip-sales-status-webhook.service.js`, `tests/oauth-events.test.js`, `docs/api/oauth.md` | — | `To do` |
| C2 | Send API: a normal message with reply buttons can have a text title and footer | `controllers/unified-whatsapp.controller.js`, its service, tests, docs | — | `To do` |

### Book server

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| S1 | Templates with buttons; nothing created or submitted automatically; "Submit to Meta" action per message and language; Meta's reason kept and shown | `features/dashboard/utils/booking-templates.ts`, `features/dashboard/api/chat-templates.ts`, `features/dashboard/api/notification-actions.ts` | W0, D1 | `To do` |
| S2 | Remove the 10 waiting templates (after D1) and move to new template names | `features/dashboard/api/chat-templates.ts`, a one-off script in `scripts/` | S1, D1 | `To do` |
| S3 | Replies: a button tap finds the message by Chat's record id, confirms or cancels the booking per the owner's setting, alerts the owner | `features/dashboard/api/chat-events.ts`, new `features/dashboard/api/notification-replies.ts`, `lib/db/schema.ts` (+ migration) | W0, C1, D2 | `To do` |
| S4 | The 24-hour setting in the sender; inside the window send a normal message with buttons | `features/dashboard/api/notification-sender.ts` | W0, C2 | `To do` |
| S5 | Owner alerts: Customer can't come, Customer cancelled, Message failed | `features/dashboard/api/notification-sender.ts`, `booking-templates.ts` | S1, S3 | `To do` |
| S6 | More fields: team member, price, address, duration (and a manage-booking link once a manage page exists) | `booking-templates.ts`, `notification-sender.ts` | W0 | `To do` |
| S7 | Opt-out: a customer who writes STOP gets no more messages | `chat-events.ts`, `notification-sender.ts` | S3 | `To do` |
| S8 | Test send to the owner's phone; "Send again" for a failed message | `notification-actions.ts`, `notification-sender.ts` | S1 | `To do` |
| S9 | Activity query with filters and search | `features/dashboard/api/notifications.ts` | W0 | `To do` |

### Book page

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| P1 | Page frame: the six parts (tabs on computer, list on phone), professional names, English and Spanish, built on today's data | `app/(owner)/dashboard/[businessId]/whatsapp/`, `features/dashboard/components/whatsapp-*.tsx`, `features/dashboard/i18n/{en,es}/whatsapp.ts` | W0 | `To do` |
| P2 | Overview: status, setup checklist, test send | `whatsapp-overview.tsx` | P1, S8 | `To do` |
| P3 | Message editor v2: buttons, preview with buttons, Meta status and reason, "Submit to Meta" | `message-editor.tsx` | P1, S1 | `To do` |
| P4 | Your alerts screen | `whatsapp-alerts.tsx` | P1, S5 | `To do` |
| P5 | Timing screen with the 24-hour setting | `whatsapp-timing.tsx` | P1, S4 | `To do` |
| P6 | Replies screen | `whatsapp-replies.tsx` | P1, S3 | `To do` |
| P7 | Activity screen: filters, search, send again | `whatsapp-activity.tsx` | P1, S9 | `To do` |

### Booking changes and finish

| ID | Task | Files | Needs | Status |
| --- | --- | --- | --- | --- |
| B1 | "Move booking" for the owner, which sends Booking changed | `features/dashboard/components/booking-*`, `features/dashboard/api/booking-actions.ts` | — | `To do` |
| F1 | Docs updated, live end-to-end test on a real number (book, reminder, tap each button, 24-hour normal message) | `docs/koblip-chat-integration.md` | all | `To do` |

## Done before this plan

| What | Commit |
| --- | --- |
| Connect with Koblip Chat (popup, consent, tokens, events) | Book d7fd076, Chat 1a2cc89 |
| WhatsApp page v1, wording editor, reminders, quiet hours, owner number | fcd265a |
| Sending engine, timer, opt-in on booking forms, delivery status, history | da6b22b |
| Wording long enough for Meta; lost templates copied back from Meta | 89f40a9, Chat 7326f7a |
| Workspace dropdown on Chat's consent page | Chat 66bb978 |
