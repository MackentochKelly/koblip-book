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
- Every message shows its two parts apart, on the admin page and the
  business page:
  - **Normal message** (inside 24 hours): the latest saved words, sent now.
  - **Template** (outside 24 hours): Meta's status, and the words Meta
    approved when they differ from the latest.
- One short helper line says how the two parts work.

## Rules that always apply

- UI rules: `docs/ui-rules/checklist.md` before and after each task; phone
  first (375px), then desktop; light and dark; theme tokens only.
- One editor for both pages, in `components/`; no copy in a feature.
- Nothing goes to Meta without a person pressing "Submit to Meta".
- Every admin save and submit goes in the change log (`platformSettingChanges`).
- Wording checks stay `wordingProblem()` (`booking-templates.ts`), on the
  page and on the server.

## Tasks

| Task | What | Needs | Files | Status |
| --- | --- | --- | --- | --- |
| M1 | Koblip's wording saved in Book: a `koblip_notification_texts` table (message, language, header, body, footer, buttons) and migration; `koblipTemplate` uses the saved wording, else Book's default; `koblipSendableTemplate` and `koblipMessages` follow it, so a saved change is a draft and normal messages use it at once (D1) | | `lib/db/schema.ts`, `drizzle/`, `features/dashboard/api/chat-templates.ts`, `features/dashboard/utils/booking-templates.ts`, tests | To do |
| M2 | Admin actions: save one Koblip message's wording and buttons (admin check, `wordingProblem`, change log `whatsapp.koblipWording.<message>.<language>`), and "Use default"; submit sends the saved wording | M1 | `features/dashboard/api/koblip-template-actions.ts`, tests | To do |
| M3 | One shared editor: `message-editor.tsx` moves to `components/`, takes its save, submit and words as props; the business page looks and works the same | | `components/message-editor.tsx`, `features/dashboard/components/message-editor.tsx` (removed), its callers, `eslint.config.mjs` if needed | To do |
| M4 | Admin Koblip messages open the shared editor: edit, save as draft, Submit to Meta; Meta's refusal reason shown as Meta gives it | M2, M3 | `features/admin/components/whatsapp-koblip-messages.tsx`, `app/(admin)/admin/whatsapp/koblip-messages/page.tsx`, admin i18n | To do |
| M5 | Two parts in the editor, Normal message and Template, each with its one-line meaning; Template shows Meta's status and the approved words when they differ | M3 | `components/message-editor.tsx`, owner and admin i18n | To do |
| M6 | Helper line on Koblip messages and on the business Messages list | M4 | `whatsapp-koblip-messages.tsx`, business messages list, i18n | To do |

## Decisions

| # | Decision | Why | Who, date |
| --- | --- | --- | --- |
| D1 | A saved change is used by normal messages right away; templates keep the words Meta approved until Meta approves the new ones | Normal messages need no approval; the owner sees the change work at once, and no template fails while Meta reviews | Owner, 2026-10-31 |
| D2 | The admin edits Koblip's set with the same editor businesses use, moved to `components/` | One shared part, never a copy (UI rules); features never import each other | Claude, 2026-10-31 |
| D3 | Koblip's wording lives in its own table, not in code; Book's default wording stays the fallback and "Use default" returns to it | The admin changes it without a release; nothing hidden | Claude, 2026-10-31 |
| D4 | Meta limits edits of an approved template (third-party guides: once a day, 10 in 30 days; not found on Meta's own pages). Book doesn't guess the limit: it shows Meta's refusal reason as is | Never build on an unverified rule; Meta's answer is the source of truth | Claude, 2026-10-31 |

## Done when

Typecheck, lint, tests and build pass; checked at 375px and desktop, light
and dark; `docs/ui-rules/checklist.md` passed.
