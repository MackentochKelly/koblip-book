# Message editing

Each WhatsApp message has one wording, sent two ways: as a normal message
inside the customer's 24-hour window, and as a template (approved by Meta)
outside it. Today a business can edit its own messages (draft until "Submit
to Meta", D8 in [WhatsApp notifications](whatsapp-notifications.md)), but the
admin can't edit Koblip's ready-made set, and no page shows the normal
message and the template apart. Approved by the owner (2026-10-31). How to
use this file: [Plans](README.md).

## Goal

- The admin edits Koblip's messages the way a business edits its own: saved
  as a draft, sent to Meta only on "Submit to Meta".
- A saved change reaches normal messages right away; the template keeps the
  words Meta approved until Meta approves the new ones (D1). Nothing stops
  sending while Meta reviews.
- Every message shows its two parts apart, on the admin page and the
  business page:
  - **Normal message** (inside 24 hours): the latest saved words, sent now.
  - **Template** (outside 24 hours): Meta's status, and the words Meta
    approved when they differ from the latest.
- One short helper line says how the two parts work.

## Lanes

Two developers work at the same time, each in their own files (D6).

| Lane | Tasks | Files it owns |
| --- | --- | --- |
| Backend dev | B1–B4 | `lib/db/schema.ts`, `drizzle/`, `features/dashboard/api/**` (`chat-templates.ts`, `koblip-template-actions.ts`, `notifications.ts`, `notification-actions.ts`), `features/dashboard/utils/booking-templates.ts`, `types/koblip-messages.ts`, `features/dashboard/types/notifications.ts`, and their tests. Never a `.tsx` file, `components/` or i18n. |
| UI dev | U1–U4 | `components/message-editor.tsx` (new), `features/dashboard/components/**`, `features/admin/components/**`, owner and admin i18n, `app/(admin)/admin/whatsapp/koblip-messages/page.tsx`. Never the Backend dev's files. |

A change the other lane's files need goes to that lane's developer, never
done for them.

## Contract

Written first, so both lanes work at the same time. Backend dev adds these
exactly; UI dev builds against them before they are filled.

```ts
// types/koblip-messages.ts — KoblipText gains:
isDefault: boolean // Book's default wording, nothing saved
approved: {
  wording: { header: string; body: string; footer: string }
  buttons: { action: KoblipButtonAction; label: string }[]
  preview: string // with sample values, as a customer reads it
} | null // exactly what goes outside 24 hours; null until Meta approved one

// KoblipSubmitResult: the "chat" error carries Meta's words.
| { ok: false; error: "chat"; reason: string | null } // ChatApiError.reason

// New:
export type KoblipSaveResult =
  | { ok: true }
  | { ok: false; error: WordingProblem | ButtonsProblem | "not_found" | "invalid" }

// features/dashboard/types/notifications.ts — NotificationText gains the
// same `approved` field (MessageButton for buttons).

// features/dashboard/api/koblip-template-actions.ts — new server action.
// null wording = back to Book's default (both wording and buttons).
export async function saveKoblipMessage(
  message: BookingMessage,
  language: TemplateLanguage,
  wording: Wording | null,
  buttons: MessageButton[] | null
): Promise<KoblipSaveResult>
```

## Rules that always apply

- UI rules: `docs/ui-rules/checklist.md` before and after each UI task;
  phone first (375px), then desktop; light and dark; theme tokens only.
- One editor for both pages, in `components/`; no copy in a feature (D2).
- Nothing goes to Meta without a person pressing "Submit to Meta".
- Every admin save and submit goes in the change log
  (`platformSettingChanges`), saved with the change.
- Wording checks stay `wordingProblem()` and `buttonsProblem()`
  (`booking-templates.ts`), on the page and on the server.
- Meta's behaviour comes from Meta's own docs, linked in the Decisions;
  never guessed.

## Tasks

| Task | Lane | What | Needs | Status |
| --- | --- | --- | --- | --- |
| B1 | Backend | Koblip's wording saved in Book: `koblip_notification_texts` (like `notification_texts`, without the business) and its migration (`npm run db:generate`); `koblipTemplate` uses the saved wording and buttons, else Book's default; `koblipSendableTemplate` sends normal messages with the saved words (D1); `koblipMessages` shows a draft when the saved words differ from what was submitted; tests | | Done (2026-10-31, b4ce94f) |
| B2 | Backend | `saveKoblipMessage` as in the Contract: admin check, values trimmed like `saveMessageWording`, `wordingProblem` and `buttonsProblem`, change log `whatsapp.koblipWording.<message>.<language>` (before and after) saved with the change, `null` back to default; `submitKoblipMessage` returns Meta's reason; the admin Change log names the new key; tests | B1 | Done (2026-10-31, 6afb192) |
| B3 | Backend | No gap while Meta reviews an edit of Koblip's set (D5): submitting a change to an approved Koblip template creates the next version (`koblip_<message>_v3`, then `_v4`, …) instead of editing it; the approved version keeps sending until the new one is approved, then Book switches to it and removes the old one in Chat and at Meta; a refused new version leaves the old one live. Book keeps both: the live version and the one in review. Tests: switch, refusal, Chat lost a template (`submitTo`'s copy-back), the refresh path | B1, B2 | Done (2026-10-31, 38eb9a9) |
| B4 | Backend | Fill the Contract's `approved` (the approved version's submitted words) on `KoblipText` and `NotificationText`, and `isDefault` on `KoblipText`; tests | B1 | Done (2026-10-31, 938f59f) |
| B5 | Backend | Delegate `fieldsForOwner`, `fieldsFromOwner` and `withExamples` to `lib/message-fields.ts` (UI D12 handoff), keeping existing callers | B4 | Done (2026-10-31, 922e7b1) |
| U1 | UI | One shared editor: `features/dashboard/components/message-editor.tsx` moves to `components/message-editor.tsx` and takes its save, submit and words as props; the business page (`whatsapp-message-list.tsx`) looks and works the same | | Done (2026-10-31) |
| U2 | UI | Two parts in the editor: **Normal message**, "Inside 24 hours · sends now", with the latest words; **Template**, "Outside 24 hours", with `MetaStatusBadge` and the approved words when they differ | U1 (B4 fills it) | Done (2026-10-31) |
| U3 | UI | The admin's Koblip messages open the shared editor: edit, save as draft, Use default, Submit to Meta; Meta's refusal reason shown as Meta gives it; the admin Change log names `whatsapp.koblipWording.<message>.<language>` (Backend handoff) | U1, B2 | Done (2026-10-31) |
| U4 | UI | One helper line on Koblip messages and on the business Messages list; anything longer in an ⓘ tooltip | U3 | To do |

## Decisions

| # | Decision | Why | Who, date |
| --- | --- | --- | --- |
| D1 | A saved change is used by normal messages right away; templates keep the words Meta approved until Meta approves the new ones | Normal messages need no approval; the change works at once, and no template stops while Meta reviews | Owner, 2026-10-31 |
| D2 | The admin edits Koblip's set with the same editor businesses use, moved to `components/` | One shared part, never a copy (UI rules); features never import each other | UI dev, 2026-10-31 |
| D3 | Koblip's wording lives in its own table, not in code; Book's default wording stays the fallback and "Use default" returns to it | The admin changes it without a release; nothing hidden | UI dev, 2026-10-31 |
| D4 | Meta limits edits: "Approved templates can be edited up to 10 times in a 30-day window, or 1 time in a 24-hour window" ([template management](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management.md)). Book doesn't count edits itself; it shows Meta's refusal reason as Meta gives it | Meta's answer is the source of truth; a copy of the limit in Book could drift from Meta's | UI dev, 2026-10-31 |
| D5 | An edit of an approved template in Koblip's set goes as a new version, not an in-place edit. A business's own copies keep editing in place (D8 in WhatsApp notifications) | Meta re-reviews an edited template (PENDING, "undergoing template review") and states only APPROVED templates as sendable ([status webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/message_template_status_update.md)). Book sends only approved templates, so an in-place edit would stop Koblip's templates during review, and Koblip's number has no fallback. A new version keeps the approved one sending and doesn't spend Meta's edit limit. A business already falls back to Koblip's number during its review (K3, D22, D34), so nothing is lost there | UI dev, 2026-10-31 |
| D6 | Two lanes, Backend dev and UI dev, each with its own files and the written Contract | Both work at the same time without touching each other's files | Owner, 2026-10-31 |
| D7 | Keep `koblipTemplate` synchronous and pure; server reads apply saved wording and null-button defaults before calling it. The business read-only message list also reads the saved Koblip wording. | Database reads belong in server code; previews and normal sends must agree. | Backend dev, 2026-10-31 |
| D8 | Admin wording saves and submits batch their database write with the audit entry; wording saves serialize per message and language so audit before/after follows save order. Validation error types live in the shared contract and are re-exported by the template utility. | No saved change can lack its change-log entry, and shared types never import a feature. | Backend dev, 2026-10-31 |
| D10 | The shared editor (`components/message-editor.tsx`) knows no feature: it takes the message, its words, the field buttons, a preview and the save and submit actions as props. Each page gives it a thin wrapper of its own: the business's `features/dashboard/components/business-message-editor.tsx`, the admin's in U3 | Shared parts never import a feature; each wrapper keeps its own actions, words and field names | UI dev, 2026-10-31 |
| D9 | The new wording key is written by B2; its human-readable Change log label belongs to U3 in the UI lane. | The renderer and translations are UI-owned files; backend completion does not claim that UI label is finished. | Backend dev, 2026-10-31 |
| D11 | Keep the latest submission, live approved snapshot and retired cleanup records separately; serialize Koblip submit/refresh operations. Refresh switches the saved live copy before remote cleanup. A changed pending copy and a missing/deleted copy advance to another version; unchanged submit requests are audited without a remote edit. | [Meta permits editing only APPROVED, REJECTED or PAUSED templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management.md); an already approved copy must keep sending and a deleted name can remain blocked. | Backend dev, 2026-10-31 |
| D12 | Field labels and sample values for the admin editor come from the shared `lib/message-fields.ts` (`fieldsToLabels`, `fieldsFromLabels`, `fillFields`); the page passes each message's fields, buttons and samples from Book's templates. Handoff: the Backend dev can make `fieldsForOwner`, `fieldsFromOwner` and `withExamples` in `booking-templates.ts` use these, so the code lives once | The admin feature may not import the dashboard's helpers; shared code is the root-cause place | UI dev, 2026-10-31 |
| D14 | Defer deleting a retired name until neither language uses it as its latest or live copy. Retain failed cleanup records, restoring a lost Chat copy through meta-list/sync before retrying. | [Meta name deletion removes all languages](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management.md#delete-template-by-name). Chat's public DELETE falls back to name deletion and removes its local copy even if Meta deletion fails (`wapi-api/controllers/template.controller.js`, deleteTemplate). | Backend dev, 2026-10-31 |
| D13 | `approved` exposes the recorded submitted snapshot on both admin and business pages, never the newest draft. Legacy rows with no recorded wording retain their existing sender fallback but return null for the approved preview; Koblip live snapshots mark that distinction. Saved wording without a recorded submitted copy is a draft, so it can be explicitly submitted. Contract-consuming `.ts` test fixtures gain `approved: null`. | Book cannot prove the actual Meta wording from an old status/id alone; reconstructed defaults must not be shown as a verified submitted copy. | Backend dev, 2026-10-31 |

### Backend handoff

U3 names `whatsapp.koblipWording.<message>.<language>` in the admin Change log
alongside the existing submit key (8e47ef2).

B4's required fields are implemented. U2 now passes each text's `approved`
to the shared editor and has updated its test fixtures.

The UI D12 handoff is complete: the three backend field helpers delegate to
`lib/message-fields.ts`. The separate cleanup decision is D14, removing the
duplicate D12 identifier.


## Done when

Typecheck, lint, tests and build pass; checked at 375px and desktop, light
and dark; `docs/ui-rules/checklist.md` passed.
