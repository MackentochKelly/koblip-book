# Email

Booking emails for customers and owners, sent through Amazon SES, with every email logged and bounces handled. Asked by the owner (Nov 10): "integrate email and email reminders".

**Status (Nov 10):** Plan only. Nothing built, nothing changed in AWS.

The owner said "S3". S3 is Amazon's file storage and cannot send mail; Amazon's email service is **SES**, and Book already sends through it. This plan uses SES.

## Rules that stay

- No tracking: no open pixels, no click tracking, no images loaded from a server.
- Booking emails only. No marketing email: it has other rules (one-click unsubscribe, consent) and is not in this plan.
- Nothing stored is hidden from the app admin.
- Keys only in `.env.local` / `.env.production`, only in server code.
- A feature never imports another feature: everything shared lives in `lib/`.
- shadcn parts only, tokens only, phone first. English words only; the other languages come from the translation run.

## What exists today

| Part | Today |
| --- | --- |
| Sending | `lib/email.ts`: nodemailer over SMTP to Amazon SES (`SMTP_*`, `EMAIL_FROM`). Never throws; returns sent or not. No message id kept. |
| Look | `lib/email-templates.ts`: one sentence, one bare link, one note. Translated (`appServer.emails`). |
| Emails sent | Sign-up confirmation, reset password (`lib/auth.ts`); team invite, team calendar link (`features/dashboard/api/`); payment failed, back to Free (`lib/billing-emails.ts`); a client's visit reminder (`lib/client-reminders.ts`). |
| Email reminder | Only for a signed-in client who picked "Remind me by: Email" (client account D16). One reminder, `clientReminderMinutes` (24 h) before. Not the business's reminder times, no quiet hours. |
| Guests | A booking stores name and phone only. **No email**, so a guest can never get one. |
| Confirmation, changed, cancelled | WhatsApp only (`notification_sends`). No email. |
| Owner alerts | WhatsApp and the bell. No email. |
| Log | `client_reminder_emails` keeps reminders only (sending, sent, failed). The other six emails leave no record. |
| Bounces and complaints | Nothing. Amazon forwards them to the From address; the app never learns and keeps sending to dead addresses. |
| Timer | `features/dashboard/api/notification-timer.ts` runs every `sendEverySeconds`; it already calls `emailClients()`. |
| Plans | `emailReminders` is listed as "soon", Pro (`lib/plan-features.ts`). |
| Admin | Notifications screen shows reminder emails and how many clients picked each way. |
| AWS account | Not seen yet: region, sandbox or production, which domain is verified, DKIM, DMARC. First task. |

## The main problems

1. **Most customers have no email in Book.** They book as guests with a phone. Email cannot reach them until the booking form asks.
2. **Nobody listens to bounces.** Amazon reviews an account near a 5% bounce rate or 0.1% complaint rate and can pause it; Gmail wants spam reports under 0.3%. A paused account also stops sign-up and password emails.
3. **Email is second-class next to WhatsApp.** WhatsApp has a planned row per message, states, delivery, owner switches and an admin screen. Email has a function call.

## How big teams do it (researched Nov 10)

| Product | Customer emails | Channels | Owner control |
| --- | --- | --- | --- |
| Square Appointments | Confirmation, reminder (1 hour to 3 days before), rescheduled, cancelled, no-show | Client picks email, text or both | Edits subject and message per type; marketing words are blocked |
| Fresha | Confirmation, reminder, rescheduled, cancelled, thank-you | Per message: email, text, WhatsApp. Email is free, the others are paid | On or off per message and channel; message history |

Amazon and Google, for the plumbing:

- Amazon requires a way to handle bounces and complaints. The full one is **event publishing**: a configuration set sends each email's events to an SNS topic, which calls the app.
- Amazon keeps an **account suppression list**: hard bounces and complaints are added, and later mail to them is accepted but not sent.
- A new SES account is in the **sandbox**: verified addresses only, 200 emails a day, 1 a second. Production access is asked for per region; first answer within 96 hours.
- Gmail: SPF or DKIM for everyone; over 5,000 a day also DMARC with an aligned From domain. One-click unsubscribe is for marketing mail, not booking mail.

Sources: [SES notifications](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications.html), [SES event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html), [SES suppression list](https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html), [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [Gmail sender rules](https://support.google.com/a/answer/81126), [Square notifications](https://squareup.com/help/us/en/article/8070-customize-notifications-for-square-appointments), [Fresha automated messages](https://www.fresha.com/help-center/knowledge-base/marketing/125-automated-messages-overview). Amazon's 5% and 0.1% review numbers are from memory of its reputation page and are checked in EM-1.

## Decisions

Made by the developer, Nov 10, as the plans' rules ask. The owner can change any of them.

- **EM-D1. Amazon SES.** Already in use, the owner's AWS account, about $0.10 per 1,000 emails. Not S3.
- **EM-D2. Send through the SES API, not SMTP.** Same nodemailer, with its SES transport and `@aws-sdk/client-sesv2`. Why: each send returns Amazon's message id (needed to match events), each send names its configuration set, and the key is an IAM user that may only send. Keys: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_CONFIGURATION_SET`; `EMAIL_FROM` stays. The `SMTP_*` keys go once the live server has switched. Without keys, sending is skipped with one warning, as today.
- **EM-D3. Events come back by SNS.** Configuration set → SNS topic → `POST /api/email/events`. The route checks Amazon's signature, confirms the subscription once, and handles Delivery, Bounce, Complaint, Reject and DeliveryDelay. No Open or Click events.
- **EM-D4. One log for every email: `email_sends`.** Kind, address, business, booking, reminder minutes, moves, due time, state (`pending → sending → sent | failed | skipped`), reason, Amazon's id, delivery (`delivered | bounced | complained | delayed`), language. Rows of `client_reminder_emails` are copied in and that table is dropped in the same migration.
- **EM-D5. Blocked addresses: `email_blocks`.** A hard bounce or a complaint blocks the address everywhere; "Stop emails" (EM-D10) blocks it for one business. A blocked address is skipped with the reason shown. Amazon's own suppression list stays on for bounces and complaints as the second guard.
- **EM-D6. The emails.** To the customer, the same four as WhatsApp: **confirmed, reminder, changed, cancelled**. To the owner: **new booking, customer cancelled, customer can't come**, to the owner's account email. The seven emails that exist stay, and go through the same log.
- **EM-D7. Who gets them.** The booking form gets one optional field, "Email"; a signed-in client's account email fills it. Stored as `bookings.customerEmail`. No email, no emails.
- **EM-D8. Email and WhatsApp together.** Confirmed, changed and cancelled go by email whenever the booking has one, next to WhatsApp (email is the receipt, as at Square and Fresha). **Reminders go one way only**: the client's "Remind me by" pick; with no pick, WhatsApp if the booking agreed to it, else email. Nobody is reminded twice.
- **EM-D9. The business's times.** Email reminders use the business's reminder times and quiet hours, the ones WhatsApp uses, replacing the single 24-hour email. `clientReminderMinutes` stays for the bell.
- **EM-D10. Owner controls.** A new "Email" page next to WhatsApp in the owner's Notifications: one switch per email, and the history. The words are Koblip's, translated; owners do not edit them in this plan. Each customer email ends with "Stop emails", a signed link that blocks that address for that business.
- **EM-D11. Plan.** Email is free on every plan: `emailReminders` becomes live, default Free. Why: it costs Koblip almost nothing, the client's email reminder is already free, and Fresha gives email free. The admin can still move it in Plans.
- **EM-D12. Look.** One shared layout for all emails: business name on top, the booking's lines (service, when, with whom, where, price), one button, a plain-text twin. No images. From name is the business's name; the address is Koblip's; replies are not read and the email says so. Confirmed and changed carry the `.ics` file (`lib/booking-calendar.ts`).
- **EM-D13. Sending.** Booking emails are planned as rows when the booking is made, moved or cancelled, and sent by the timer in batches (`sendBatch`), like WhatsApp. Amazon's "slow down" answers are tried again up to 3 times; anything else fails once and is shown. Account emails (sign-up, reset) are sent at once and logged.

## AWS setup (in the browser, after the owner's go)

The owner signs in to AWS; the developer never types a password or a key. Each change below is named to the owner before it is made.

1. Look: region in use, sandbox or production, verified identities, DKIM, MAIL FROM, DMARC, suppression settings, sending numbers.
2. Domain: `koblip.com` verified with Easy DKIM; a custom MAIL FROM subdomain; a DMARC record. DNS records are added where the domain's DNS lives (the owner says where).
3. Configuration set `koblip-book` with an SNS event destination; SNS topic `koblip-book-email`; HTTPS subscription to `https://book.koblip.com/api/email/events` (needs EM-4 live).
4. Suppression list on for bounces and complaints.
5. IAM user `koblip-book-email` allowed only `ses:SendEmail` from the verified identity with that configuration set. The owner copies its key into `.env.production` and `.env.local`.
6. If in the sandbox: ask for production access (Transactional, website `https://book.koblip.com`).

## Tasks

| ID | Task | Needs | Files it owns | Status |
| --- | --- | --- | --- | --- |
| EM-1 | Look at the AWS account and write what is there into `docs/email.md` (new) | – | `docs/email.md` | To do |
| EM-2 | AWS setup steps 2, 4, 5, 6 | EM-1 | `docs/email.md` | To do |
| EM-3 | Tables `email_sends` and `email_blocks`, migration, copy of `client_reminder_emails` | – | `lib/db/schema.ts` (email), `drizzle/` | To do |
| EM-4 | Send through the SES API with the log; events route with signature check; blocks | EM-3 | `lib/email.ts`, `lib/email-sends.ts`, `lib/email-events.ts`, `app/api/email/events/`, `docs/setup.md`, `docs/deploy.md`, `scripts/deploy.sh` (email check) | To do |
| EM-5 | AWS setup step 3, then a real bounce and complaint with Amazon's mailbox simulator | EM-2, EM-4 deployed | `docs/email.md` | To do |
| EM-6 | Shared email layout; the existing seven emails moved onto it and the log | EM-4 | `lib/email-templates.ts`, `lib/email-layout.ts`, `lib/billing-emails.ts`, `lib/auth.ts` (send calls), `lib/i18n/en/` (emails) | To do |
| EM-7 | "Email" on the booking form and `bookings.customerEmail`; owner's new-booking form too | – | `features/booking/` (form, create), `features/dashboard/` (owner booking form), `lib/db/schema.ts` (bookings) | Public form: Done (Nov 11, see commit). Owner's form: To do |
| EM-8 | Plan and send the customer's four emails; reminders by the business's times, quiet hours and EM-D8; "Stop emails" link | EM-6, EM-7 | `lib/booking-emails.ts`, `lib/client-reminders.ts`, `features/dashboard/api/notification-timer.ts`, `app/(public)/email/stop/` | To do |
| EM-9 | Owner's three emails | EM-8 | `lib/booking-emails.ts`, `lib/db/schema.ts` (settings) | To do |
| EM-10 | Owner's Email page: switches and history | EM-8 | `features/dashboard/` (email page), `app/(owner)/` (route) | To do |
| EM-11 | Admin → Email: every email, blocked addresses, rules; `emailReminders` live and Free | EM-4 | `features/admin/` (email screen), `app/(admin)/admin/email/`, `lib/plan-features.ts` | To do |
| EM-12 | Assistant tools for the Email page's switches and history | EM-10 | `app/api/assistant/tools.ts` | To do |
| EM-13 | Checks: phone and computer, light and dark, English and Spanish; typecheck, lint, tests, build; one real booking with each email | all | – | To do |

Order: EM-1 → EM-2, with EM-3 → EM-4 alongside → EM-5 → EM-6 + EM-7 → EM-8 → EM-9 + EM-10 + EM-11 → EM-12 → EM-13.

## Not in this plan

- Marketing email and newsletters.
- Owners editing the emails' words.
- Receiving email (replies).
- SMS.

## Decisions log

| Date | Who | What | Why |
| --- | --- | --- | --- |
| Nov 10 | Developer | EM-D1 to EM-D13 | See each decision |
| Nov 11 | Owner, developer | EM-D7 changed: Email is **required** on the public booking form. Signed out, the app's one sign-in (`AuthForm`: Google, More options) **replaces** Contact info, so every booking comes from an account; signed in, Contact info shows filled from the account | The owner's call: every customer has an account and an email |
| Nov 11 | Owner, developer | The server books a real business only for a signed-in account (`book()` answers `signIn`, and the page shows the sign-in again). A visitor's demo copy still books signed out. The account comes from the app's sign-in, which signs in or makes the account (Google, email with name and password, phone code); never an account made silently from a typed email | Every booking has an account and an email; an unproved email must not open someone else's account |
