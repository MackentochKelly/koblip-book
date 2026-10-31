# Integrations tabs

Integrations is one long list today: the owner scrolls past many "Coming
soon" rows to find the apps they use. Big apps split what you use from what
you can add (Shopify: Installed / App Store; Slack: Manage / Browse).
Approved by the owner (2026-10-31): two tabs, Koblip's WhatsApp number
connected by default, Google Calendar suggested. How to use this file:
[Plans](README.md).

## Goal

Two tabs on Integrations, like Services (`components/view-tabs.tsx`):

- **Connected** (opens first): every app working for the business, each
  with **Manage**. Under it, a **Suggested** group (Google Calendar first)
  with Connect.
- **All apps**: today's full list, grouped as now (Messaging, Get found,
  Calendar, Payments, Reviews, Tracking).

## Rules that always apply

- UI rules: `docs/ui-rules/checklist.md` before and after each task; phone
  first (375px), then desktop; light and dark; theme tokens only.
- Only shadcn parts from `components/ui` and shared parts from `components/`
  (`ViewTabs`, `ResponsivePanel`); no hand-made copies.
- Which WhatsApp number sends always comes from `senderFor(businessId)`
  (`features/dashboard/api/notification-sender.ts`), never a second check,
  so the page and the sender never disagree (D26 in
  [WhatsApp notifications](whatsapp-notifications.md)).
- Nothing is removed: every app on the page today stays on All apps.

## Tasks

| Task | What | Needs | Files | Status |
| --- | --- | --- | --- | --- |
| I1 | Tabs Connected / All apps on Integrations with `ViewTabs`, as `services-view.tsx` does; All apps is today's list unchanged | | `features/dashboard/components/integrations-view.tsx`, `features/dashboard/i18n/{en,es}/integrations.ts` | Done (2026-10-31) |
| I2 | WhatsApp on Connected: "Koblip number", connected by default when Koblip's number sends for the business; their own number when theirs sends (`senderFor`) | I1 | `app/(owner)/dashboard/[businessId]/integrations/page.tsx`, integrations-view, i18n | Done (2026-10-31) |
| I3 | WhatsApp Manage panel (`ResponsivePanel`): which number sends; "Use your own number" starts the Koblip Chat connect (`/api/chat/connect`, `useConnectWindow`); with their own number: its workspace and Disconnect (back to Koblip's number) | I2 | new `features/dashboard/components/whatsapp-panel.tsx`, integrations-view, i18n | Done (2026-10-31) |
| I4 | Koblip Chat's inline Disconnect moves into its Manage panel, like Google Calendar's (`google-calendar-panel.tsx`), so every connected row is the same: Connected + Manage | I1 | integrations-view, whatsapp-panel | Done (2026-10-31) |
| I5 | Suggested group on Connected: apps that work today and aren't connected yet, Google Calendar first, each with Connect; hidden when none are left. "Coming soon" apps are never suggested | I1 | integrations-view, i18n | To do |
| I6 | Connected with nothing in it (no Koblip number, such as a demo business): a title and one "See all apps" button | I1 | integrations-view, i18n | To do |

## Decisions

| # | Decision | Why | Who, date |
| --- | --- | --- | --- |
| D1 | Tabs on the same page and address, not a new page | Matches Services; nothing moves for the owner | Owner, 2026-10-31 |
| D2 | Connected opens first; Suggested is a group inside Connected, not a third tab | The owner sees what to add next right under what they use; one main action per screen | Owner, 2026-10-31 |
| D3 | WhatsApp on Koblip's number counts as connected | K3 already sends from it for every owned, non-demo business, so WhatsApp works without the owner doing anything; Manage lets them switch to their own number | Owner, 2026-10-31 |
| D4 | Koblip Chat's Manage opens the WhatsApp panel, not a panel of its own | Koblip Chat is how the business's own WhatsApp number connects, so the number is managed in one place | Claude, 2026-10-31 |

## Done when

Typecheck, lint, tests and build pass; checked at 375px and desktop, light
and dark; `docs/ui-rules/checklist.md` passed.
