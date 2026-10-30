# Koblip Chat integration

Koblip Chat (the Wapi repositories, API at `https://api.koblip.com`) holds a business's official WhatsApp connection. Koblip Book connects to it with the business's own Chat API key and workspace id, the same way Koblip Sales does. Book never holds Meta credentials.

Status: step 1 is being built. Check the code before treating a later step as shipped.

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

## Later steps (not started)

- Send a booking confirmation and reminders through a Chat flow.
- Start a flow when a booking is made or cancelled.
- Replies arriving in the Chat inbox: nothing needed in Book.
- Chat's callbacks into Book, signed like the Sales ones.

Each step gets its own section here before it is built.
