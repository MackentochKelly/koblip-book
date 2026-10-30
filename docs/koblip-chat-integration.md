# Koblip Chat integration

Koblip Chat (the Wapi repositories, API at `https://api.koblip.com`) holds a business's official WhatsApp connection. Koblip Book connects to it with "Connect with Koblip Chat" (OAuth, step 1 below). Book never holds Meta credentials.

Status: step 1 is built on both sides, not yet live. Check the code before treating a later step as shipped.

Book's side: `app/api/chat/connect` (opens Chat's consent page), `app/api/chat/callback` (swaps the code), `app/(owner)/connect/chat` (closes the window), `features/dashboard/api/chat-oauth.ts` (tokens, refresh, disconnect), table `chat_connections`. Settings: the `CHAT_*` and `TOKEN_ENCRYPTION_KEY` lines in `.env.example`. Chat's side: `wapi-api` `docs/api/oauth.md`; Book's callback URL must be registered there exactly.

## Split of work

| Part | Owner | Where |
| --- | --- | --- |
| Chat API changes | Backend developer | `Wapi/wapi-api` only |
| Book server side: saving the key, calling Chat | Backend developer | `features/dashboard/api`, `lib/db` |
| Book screens, states, English and Spanish words | Front end | `features/dashboard/components`, `features/dashboard/i18n` |
| The contract below | Both | this file |

## Chat as it is today

Verified in `Wapi/wapi-api` docs and routes:

- Auth: `X-API-Key: <tenant key>` and `x-workspace-id: <workspace id>` on every call.
- `POST /api/contacts/find-or-create` `{ phone_number, name?, external_id? }`
- `POST /api/automation/:flowId/start` `{ contact_id, whatsapp_phone_number_id?, variables? }`
- `POST /api/sequences/enrollments` `{ contact_id, sequence_id, whatsapp_phone_number_id }`
- Signed booking links and status callbacks: `docs/api/booking-link.md`, `docs/koblip-sales-integration.md` in that repository.

## Step 1: Connect with a popup

The owner taps Connect in Koblip Book. A Koblip Chat window opens, they log in, choose a workspace if they have more than one, and tap Allow. The window closes and Book shows Connected. No key and no ID is typed. This is OAuth 2.0 authorization code flow with PKCE, the standard for an app acting for a person.

### Flow

1. Book opens `https://chat.koblip.com/connect/koblip-book` with `client_id`, `redirect_uri`, `state`, `code_challenge`, `scope`.
2. Chat shows its consent page (built from the existing `connect-whatsapp` layout and `OnboardingShell`): login if needed, workspace choice if more than one, what Book may do, Allow or Cancel.
3. On Allow, Chat sends the window back to Book's `redirect_uri` with a one-time `code` and the same `state`.
4. Book's server swaps the code for tokens at Chat, stores them encrypted, and shows Connected.
5. Disconnect in Book, or in Chat's "Connected apps", revokes the tokens on both sides.

### Chat API (backend developer, `Wapi/wapi-api`)

- A registry of apps: Koblip Book has a `client_id`, a `client_secret`, and an exact list of allowed `redirect_uri`s. No wildcards. Secret only in server settings.
- `POST /api/oauth/authorize` (logged-in owner): checks the app, redirect and scopes; creates a one-time code, valid 60 seconds, tied to the owner, the chosen workspace, the scopes and the PKCE challenge.
- `POST /api/oauth/token`: swaps code and PKCE verifier for an access token (short life) and a refresh token. Codes work once. Both tokens are tied to one workspace and the granted scopes.
- `POST /api/oauth/token` with a refresh token gives a new pair and retires the old refresh token.
- `POST /api/oauth/revoke`, and a list of connected apps per workspace with a revoke action.
- Existing routes accept `Authorization: Bearer <access token>` next to `X-API-Key`, and the scopes limit what it may call: contacts, automations, conversations. The workspace comes from the token, never from a header the app sends.
- Failure answers use the existing error shapes. Rate limits on authorize and token. Log every grant and revoke without logging tokens.

### Book server (backend developer, `features/dashboard/api`, `lib/db`)

- Callback route that checks `state`, then swaps the code.
- Stores per business: access token, refresh token (both encrypted, server only), workspace name, scopes, connected time. The browser only learns connected or not, and the workspace name.
- Refreshes the token before it expires; if refresh fails, the business shows "Reconnect".
- `disconnectChat` revokes at Chat, then deletes the tokens.

### Screens (front end)

- Book: the Koblip Chat row's Connect button opens the popup; states are Not connected, Connecting, Connected (workspace name, Disconnect with a question first), Reconnect, and a short error line. English and Spanish. The key panel built earlier is removed.
- Chat: the consent page and a "Connected apps" list with Revoke.

### Order

1. Backend developer: Chat OAuth API and its tests.
2. Front end: Chat consent page, built against that API.
3. Backend developer: Book callback, storage, refresh, disconnect.
4. Front end: Book Connect button and states.

## Step 2: Booking notifications on WhatsApp (planned)

### Messages

| Message | To | When |
| --- | --- | --- |
| Booking confirmed | Customer | Right after booking |
| Reminder | Customer | Before the visit |
| Booking changed or cancelled | Customer | When it changes |
| New booking | Owner's own WhatsApp | Right after booking |

### When reminders go (agreed with the owner)

Counted from when the customer booked to when the visit starts:

| Booked ahead | Customer gets |
| --- | --- |
| More than 24 hours | Confirmation now, reminder 24 hours before, reminder 30 minutes before |
| 3 to 24 hours | Confirmation now, reminder 2 hours before, reminder 30 minutes before |
| 1 to 3 hours | Confirmation now, reminder 30 minutes before |
| Less than 1 hour | Confirmation only |

- No messages from 9 pm to 8 am in the business's time zone: a 24-hour or 2-hour reminder that would land then goes at 8 pm the evening before; a 30-minute one is skipped.
- A changed booking works its reminders out again; a cancelled one stops them. Each reminder goes once.
- The owner's "New booking" goes right away.
- Why: a 24-hour reminder has the best evidence ([study](https://acofp.org/news-and-publications/journal/article-detail/vol-12-no-5-(2020)-september-october-2020/evaluation-clinical-no-show-rates-setting-outpatient-internal-medicine-residency-clinic)); earlier bookings need earlier reminders ([paper](https://ideas.repec.org/a/taf/tjorxx/v69y2018i11p1863-1875.html)); Fresha and Square work the same way ([Fresha](https://www.fresha.com/blog/making-the-most-of-freshas-notifications), [Square](https://square.com/gb/en/appointments/features/reminders)). The night rule and the 30-minute reminder are the owner's choices.

### The 24-hour rule (Meta, verified)

- A customer's message opens a 24-hour window; another message resets it. Inside it any message may be sent; outside it only an approved template ([Meta: send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)).
- Inside the window we send plain text with the template's words (bold title, text, footer), so both look the same, as Koblip Sales does.
- Only people who agreed to WhatsApp messages may be messaged (same Meta page).

### Chat today (verified in `wapi-api`)

- `POST /api/whatsapp/send` does not check the window; only the chat screen does (`canChat`, from the last inbound message's `wa_timestamp`). Meta would refuse a free message after 24 hours.
- Its reply-buttons message carries only an image header: no text header, no footer.
- Ready-made templates exist (`is_admin_template`, `GET /api/templates/admin-templates/list`), but a business copies one by hand in Chat. OAuth apps cannot touch templates.
- Book can find or create a contact (`contacts` scope) and send (`conversations` scope).

### Chat API (backend developer, `wapi-api`): same access as Koblip Sales

Book uses Chat's public API like any other company. Koblip Sales already creates templates, sends them, and receives customer replies through Chat's API key and signed callbacks. The popup connection only gets the same:

1. A `templates` scope: the existing `/api/template` routes (list, get, create, sync status).
2. Signed events (customer replies, sent messages, delivery status) for each workspace that connected the app, reusing what Chat sends Koblip Sales.

### Book (`features/booking`, `features/dashboard`): everything else

1. The template set (wording in English and Spanish) lives in Book. After connecting, Book creates the templates in the business's Chat through the API and shows "Waiting for Meta approval" until approved.
2. Book records each customer's last reply from Chat's events. Under 24 hours it sends plain text with the template's words (title, text, footer), otherwise the approved template, the same way Koblip Sales does.
3. Booking form: a WhatsApp checkbox; the answer is saved on the booking.
4. Settings: the owner's own WhatsApp number (must differ from the business number).
5. Integrations, under Koblip Chat: one switch per message.
6. Sends on booking made, changed or cancelled, and the reminders above (Book needs a timer; each reminder goes once).
7. A record per booking of what was sent or why not.

### Order

1. Chat API 1 and 2, with tests.
2. Book 1 to 7, built against it.
3. One end-to-end test on this Mac, like step 1.

## Later steps (not started)

- WhatsApp broadcasts.
- Replies arriving in the Chat inbox: nothing needed in Book.
- Chat's callbacks into Book, signed like the Sales ones.

Each step gets its own section here before it is built.
