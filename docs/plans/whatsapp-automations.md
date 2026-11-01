# WhatsApp automations

When a customer writes to the business on WhatsApp, Book answers by itself
with a short message and up to three buttons, like ManyChat. The first
automation is **Welcome**. The data and the engine are general, so more
automations can come later without new tables. Approved by the owner
(2026-10-31). How to use this file: [Plans](README.md).

## Goal

- A customer writes for the first time. Within seconds they get:

  > Thanks for writing to {Business}! Choose an option to get help faster.
  >
  > [Book now] [Our services] [Talk to us]

- **Book now**: a link button that opens the business's booking page.
- **Our services**: a list of the business's services (up to 10). Tapping
  one sends that service's booking link.
- **Talk to us**: "Got it, someone will answer you soon." The owner's bell
  hears it, and automations stay quiet for this customer (D5).
- The owner edits everything (D10): turns Welcome on or off, edits every
  word (English and Spanish), adds, removes and reorders buttons (1 to 3),
  renames them and picks what each one does. Every run shows in Activity.
- Nothing is hard-coded: wording, buttons, actions and limits come from
  stored data and rules, checked by one shared validator.

## Lanes

| Lane | Tasks | Files it owns |
| --- | --- | --- |
| Backend dev (Codex) | B1–B6 | `lib/db/schema.ts`, `drizzle/`, `features/dashboard/api/automation-*.ts` (new), `features/dashboard/api/chat-events.ts` (one hook only, B4), `features/dashboard/types/automations.ts` (new), `features/dashboard/utils/automation-*.ts` (new), `lib/platform-settings.ts` (new rules only), and their tests. Never a `.tsx` file, `components/`, `app/` or i18n. |
| UI dev | U1–U5 | `components/**` (new shared parts), `features/dashboard/components/**`, `features/admin/components/**`, owner and admin i18n, `app/(owner)/dashboard/[businessId]/automations/**`, `app/(admin)/admin/**`. Never the Backend dev's files. |

A change the other lane's files need goes to that lane's developer, never
done for them.

## Contract

Written first, so both lanes work at the same time. Backend dev adds these
exactly; UI dev builds against them before they are filled.

```ts
// features/dashboard/types/automations.ts

export type AutomationTrigger = "firstMessage" // more later (D1)
export type AutomationLanguage = "en" | "es"

// What a button does. Each one is data, never a branch in the UI.
export type AutomationAction =
  | { type: "bookingLink" } // cta_url button to the booking page
  | { type: "servicesList" } // interactive list of services
  | { type: "handoff" } // tell the owner, pause automations (D5)

export type AutomationButton = {
  id: string // stable, used as the WhatsApp button payload
  label: Record<AutomationLanguage, string> // ≤ rules.maxButtonLabel
  action: AutomationAction
}

export type AutomationWording = Record<AutomationLanguage, {
  body: string // ≤ rules.maxBody; may use {business}
  // The reply for each action that sends words of its own.
  handoffReply: string
  servicesIntro: string
}>

export type Automation = {
  id: string
  trigger: AutomationTrigger
  on: boolean
  wording: AutomationWording
  buttons: AutomationButton[] // 1..rules.maxButtons (3)
  isDefault: boolean // Book's wording, nothing saved
  updatedAt: string
}

export type AutomationProblem =
  | "empty" | "tooLong" | "tooManyButtons" | "duplicateLabel"
  | "badField" | "noOwnNumber" | "not_found" | "invalid"

export type AutomationSaveResult =
  | { ok: true }
  | { ok: false; error: AutomationProblem; field?: string }

export type AutomationRun = {
  id: string
  automationId: string
  customerPhone: string
  customerName: string | null
  step: "welcome" | "bookingLink" | "servicesList" | "serviceLink" | "handoff"
  state: "sent" | "failed" | "skipped"
  reason: string | null // why it failed or was skipped
  at: string
}

// features/dashboard/api/automation-queries.ts
export async function automationsFor(businessId: string): Promise<Automation[]>
export async function automationRuns(
  businessId: string,
  filter: { automationId?: string; state?: AutomationRun["state"]; cursor?: string }
): Promise<{ runs: AutomationRun[]; next: string | null }>

// features/dashboard/api/automation-actions.ts ("use server")
export async function saveAutomation(
  businessId: string,
  automationId: string,
  input: { wording: AutomationWording; buttons: AutomationButton[] } | null // null = Book's default
): Promise<AutomationSaveResult>
export async function setAutomationOn(
  businessId: string, automationId: string, on: boolean
): Promise<AutomationSaveResult>
```

## Tasks

### Backend (Codex)

| # | Task | Needs | Status |
| --- | --- | --- | --- |
| B1 | Tables `automations`, `automationRuns`, `automationEvents` (event ids seen, D6), `automationPauses` (customer, until). Migration with drizzle-kit. One `welcome` row per business is made on first read with Book's default wording (no seed script). | — | To do |
| B2 | `utils/automation-rules.ts`: one validator `automationProblem(input, rules)` for every limit in D7. Used by the save action and by the sender before each send. Unit tests for each limit. | B1 | To do |
| B3 | Contract queries and actions. Every action: owner check first (`getOwnerBusiness`), then validate, then save in one transaction. `noOwnNumber` when the business has no usable own number (D2). | B1, B2 | To do |
| B4 | In `applyChatEvent`, after the reply is stored: call `runAutomations(event)` from `automation-engine.ts`. Do not change anything else in that file. | B1 | To do |
| B5 | `automation-engine.ts`: trigger match (D3), dedupe (D6), pause (D5), send through Chat's public `POST /api/whatsapp/send` with the same `Line`/`post` path the reminders use (button, `cta_url`, `list` interactive types), log every run. Button taps come back as `inbound` with `button.payload` = the button id. | B2, B4 | To do |
| B6 | Tests: first message sends Welcome once; a repeated event sends nothing; a second message within D3's window sends nothing; each button's action; handoff pauses; Koblip's number sends nothing (D2); a Chat error logs `failed` and never throws out of the webhook. | B5 | To do |

### UI

| # | Task | Needs | Status |
| --- | --- | --- | --- |
| U1 | New Automations tab **Flows** (D11): a list of automations (Welcome for now), each a card with its switch, like Messages. | Contract | To do |
| U2 | Shared `components/flow-steps.tsx`: the flow as steps top to bottom (trigger → message → each button → what it does). Phone first. Built from shadcn parts only (Item, Card, Badge, Field). No canvas (D11). | Contract | To do |
| U3 | Flow editor in a ResponsivePanel: every word, and the buttons (add, remove, reorder, rename, pick the action from the closed list) with an EN/ES switch on the first field's row, like the message editor. Preview with the shared `WhatsappPreview` at the bottom. Reset brings back Book's default. Errors from `AutomationProblem` under their field. | U2 | To do |
| U4 | Activity: automation runs in the existing list, with an "Automations" filter. | B3 | To do |
| U5 | Admin: every business's automations and runs, read-only (nothing hidden). | B3 | To do |

## Decisions

- **D1 General data, one trigger now.** Automations are rows with a trigger
  and buttons; actions are a closed union checked by the validator. A new
  automation later is new data plus, at most, a new action type.
- **D2 Own number only.** Koblip's shared number serves many businesses, so a
  first message to it cannot tell which business it is for. Welcome runs only
  on a business's own connected number. The UI says so when there is none.
- **D3 "First time".** The customer has no earlier `chatReplies` row for this
  number, or their last message is older than `rules.welcomeAgainDays`
  (admin rule, default 30).
- **D4 No templates needed.** The customer just wrote, so the 24-hour window
  is open: Welcome and every button reply are normal (free) messages. Nothing
  goes to Meta for review.
- **D5 Handoff and quiet.** After "Talk to us", or when anyone sends the
  customer a message by hand from Koblip Chat (an `outbound` event Book did
  not send), automations stay quiet for that customer for
  `rules.handoffQuietHours` (default 24).
- **D6 At least once.** Chat delivers events at least once: store each
  `eventId` before acting; a repeat does nothing.
- **D7 Meta's limits** (rules, never literals in code): body ≤ 1024, reply
  button label ≤ 20, at most 3 buttons, `cta_url` text ≤ 20, list row title
  ≤ 24, at most 10 rows, header ≤ 60.
- **D8 Language.** Welcome goes in the business's page language; each
  button reply follows the same language (D11).
- **D9 Webhook stays fast.** A send that fails is logged as `failed` with
  its reason; the webhook still answers 200 so Chat does not retry it.

- **D10 Everything editable** (owner, 2026-10-31). Every word, every button
  label, how many buttons (1–3), their order and each one's action are the
  owner's. Book's default: "Book now" (bookingLink), "Our services"
  (servicesList), "Talk to us" (handoff). Two buttons may not share an action
  or a label (`duplicateLabel`, and `badField` for a repeated action).
- **D11 Owner's answers** (2026-10-31): the tab is **Flows**; the editor is a
  step list, not a canvas; Welcome and its replies go in the business page's
  language.

## Rules for the Backend dev (read before every task)

1. Read `AGENTS.md`, this file and the bundled Next.js docs
   (`node_modules/next/dist/docs/`) for any Next API you use. Never guess an
   API, option or model name.
2. Stay in your lane's files. If the contract must change, stop and ask; do
   not change it yourself.
3. Use what exists: `Line`, `post`, `ChatApiError`, `notify`,
   `getOwnerBusiness`, `notificationRules`, `saveAll`. Never copy one.
4. Every server action: owner check, validate with `automationProblem`,
   then write in one transaction. Return the contract's results; never throw
   to the UI.
5. Limits and timings come from rules (`lib/platform-settings.ts`), never a
   number in the code.
6. No secrets in code or logs. Never log message text or phone numbers.
7. Tests for every rule and branch in B6, with fake timers and a fake Chat.
8. Small steps. Before saying a task is done: `npm run typecheck`,
   `npm run lint`, `npm test`, `npm run build`, all green. Paste the output.
9. Never commit or push; the owner does that. Update this file's task
   status in the same change as the work.
