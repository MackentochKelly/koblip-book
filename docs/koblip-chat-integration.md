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

## Step 1: Connect

The owner opens Integrations, taps Connect on Koblip Chat, enters the API key and the workspace id, and Book checks them.

### Book stores, per business

| Field | Rule |
| --- | --- |
| API key | Encrypted at rest, server only, write only. Never sent back to the browser; only `last4` and a connected flag are. |
| Workspace id | Plain text. |
| Connected at | Set when a check succeeds. |

Secrets follow `AGENTS.md`: only in server code, with the `server-only` package.

### Book server actions

| Action | Input | Result |
| --- | --- | --- |
| `connectChat` | `{ businessId, apiKey, workspaceId }` | `{ ok: true, last4 }` or `{ ok: false, reason }` |
| `disconnectChat` | `{ businessId }` | `{ ok: true }` |

`reason` is one of `invalid_key`, `wrong_workspace`, `no_permission`, `unreachable`. The screen maps each to one short line in English and Spanish.

Only the business owner may call either action. The check never stores anything when it fails.

### Chat side (open item for the backend developer)

Chat has no light call that proves a key and workspace work and returns what the key may do. Add one, in `Wapi/wapi-api`:

`GET /api/integrations/verify` with the usual two headers.

Success: `{ "success": true, "data": { "workspaceId": "…", "permissions": { "contacts": true, "automations": true, "conversations": true } } }`

Failure uses the existing error shapes (401 invalid key, 403 wrong workspace or no permission). Rate limited per key. No contact data in the answer.

Until it exists, Book cannot tell `no_permission` from `invalid_key`.

### Screen states (front end)

1. Not connected: Connect button.
2. Connecting: the panel's button shows a spinner.
3. Error: one line under the field, from `reason`.
4. Connected: the badge, the key's last 4, and a Disconnect action that asks first (`ConfirmRemove`).

## Later steps (not started)

- Send a booking confirmation and reminders through a Chat flow.
- Start a flow when a booking is made or cancelled.
- Replies arriving in the Chat inbox: nothing needed in Book.
- Chat's callbacks into Book, signed like the Sales ones.

Each step gets its own section here before it is built.
