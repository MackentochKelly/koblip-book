# Nova theme

A business can pick a second look, Nova, in Settings → Theme. Nova is the look of the old bookings screens in Koblip Sales (shadcn's Nova style). This plan is the handoff for what is left.

**Status (Nov 9, evening):** Nova is committed on `after-hackathon` as `4aee17ae`, this plan as `7da92a78`. The Nova checks below and the two legacy features (pay outside the app, calendar colour per team member) are built and checked on this Mac but **not committed**. Nothing is pushed or deployed. Every business is still on Luma. This plan is not in the [plans list](README.md) yet (NV9).

## Scope: appearance only

- Nova changes colours, corners, lines, field style and the title font. Nothing else.
- Book's layouts, navigation, features, wording, behaviour and data stay exactly as they are, in both themes.
- Luma must not change at all.
- Both themes read the same data through the same code. No second backend, no data migration, no sync.
- Any legacy feature the owner approves later (see the end) must work in every theme.
- Light and dark are a separate choice, the visitor's own. Every theme has both.

## What is done

- **Theme layer.** A business's layout puts a hidden mark on the page (`BusinessTheme`). `app/globals.css` gives the whole page that look with `:root:has(...)`, so menus, dialogs and sheets wear it too. No script, so no flash and no reload, and the look leaves with the business.
- **Where it applies.** Owner dashboard, team area, and all public pages of a business (`/b/<slug>`, booking, team, policies).
- **Nova's values**, taken from `koblip-sales/frontend/src/styles/tokens.css` and `theme-overrides.css`: black main buttons, squarer corners, outlined fields, full-pixel lines, white pages with a light grey sidebar, Geist titles, dark grey dark mode.
- **Settings → Theme.** Nova has Preview (shows that screen in the look, saves nothing, ends when stopped or on leaving) and Activate. Switching back is Activate on Luma.
- **Storage.** The existing `businesses.theme` field. No new table.
- **Assistant.** `change_theme` turns Nova on with no code change, as it reads `lib/theme-rules.ts`.

### Files

| File | What it holds |
| --- | --- |
| `lib/theme-rules.ts` | The list of themes and which are built |
| `components/business-theme.tsx` | `BusinessTheme` (a business's mark) and `ThemePreview` |
| `lib/business-theme.ts` | Reads a business's theme by slug or id |
| `app/globals.css` | Corner scale and title font as per-theme values; the Nova block; Nova's field and title rules |
| `app/layout.tsx` | Loads Geist, not preloaded |
| `app/(owner)/dashboard/[businessId]/layout.tsx` | Mark for the dashboard |
| `app/(team)/team/[memberId]/layout.tsx` | Mark for the team area |
| `app/(public)/b/[slug]/layout.tsx` | Mark for the public pages (new layout) |
| `features/dashboard/components/theme-section.tsx` | Preview and Activate |
| `features/dashboard/i18n/en/settings.ts` | "Preview", "Stop preview" |
| `lib/theme-rules.test.ts`, `app/api/assistant/tools.test.ts` | Tests |

### Already checked (Nov 9, this Mac, demo business, local database)

Luma's values unchanged; preview both ways; activate and reload; public page and a full booking under Nova; that booking still there under Luma; another business and the home page stay Luma while one is Nova; dark mode; 375px with no sideways scroll; public page in Spanish. Related tests pass, lint is clean on the changed files, the app compiles.

## Decisions

- **NT1. A look is tokens plus a few slot rules, in `app/globals.css` only.** No per-theme components and no caller-side classes. A new theme is one block there and `available: true` in `lib/theme-rules.ts`.
- **NT2. The mark is on the page, the rule is on `:root`.** A wrapper would miss menus and dialogs, which render outside it.
- **NT3. Sizes stay Book's.** The old app is more compact (32px controls, tighter cards). Copying that would change layout and tap targets, which is out of scope.
- **NT4. Grey text keeps Book's darker value** in Nova, not the old app's, so it still passes 4.5:1.
- **NT5. Preview lives on the Theme screen only.** It never saves and never reaches the public page.

## Tasks

In order of importance. Each is a check first; fix only what the check finds, inside the files above.

| ID | Task | Status (Nov 9) |
| --- | --- | --- |
| NV1 | Compare with the real old screens | **Blocked.** The old Bookings screens need a Koblip Sales account with the bookings product; the Sales demo is sales-only and sends Bookings away. Only the general look was compared (see below). |
| NV2 | Dialogs, sheets, menus, selects, date picker, calendar under Nova | **Done.** Checked in Nova dark: date-range picker, Add booking dialog (selects, checkboxes, day strip), focus ring, calendar view. Nova light: team form and its select menu, booking details, payments form. Nothing to fix. |
| NV3 | Contrast under Nova, measured | **Done, one open point.** All text passes except small badge text: "Not marked" 2.74–2.85, "Active" 3.86 (3.28 in Nova dark), "Closed now" 3.97, "Booked" 4.08–4.25, "⌘K" 4.14–4.43. Luma measures the same, so this is not from Nova. Fixing it changes Luma's badge colours: needs the owner. |
| NV4 | Team area under Nova | **Blocked.** The team area needs a real account that joined as a team member; the demo guest is refused. The layout reads the business's theme the same way as the dashboard (`app/(team)/team/[memberId]/layout.tsx`), not seen in a browser. |
| NV5 | 1280, 1920, 375 and 320px | **Done.** No sideways scroll on 17 owner screens, the public page and the booking flow in Nova at 320, 375, 1280 and 1920; and in Luma at 375 and 1280 (plus Settings → Payments). |
| NV6 | Spanish in the owner area | **Done, one fix open (Nov 10).** Translated; the row fits at 375px. "Preview" reads "Avance" in Spanish; it should be "Vista previa". Fix in Admin → Translations or reword the English. |
| NV7 | Luma regression pass | **Partly.** Switched the demo back to Luma: Luma's colours and corners return, same contrast numbers as before, no sideways scroll on the same screens. No side-by-side picture comparison with the build before `4aee17ae`. |
| NV8 | Open look questions | Needs the owner (below). |
| NV9 | Add this plan to `docs/plans/README.md` | **Waiting.** The README holds another session's uncommitted changes. |

### NV1: what could be compared

Koblip Sales (demo, sales screens) next to Book in Nova: main colour, sidebar grey, Geist titles, corner size and tab corners match. Differences seen:

- The old app is more compact (smaller controls, tighter cards): leave (layout, NT3).
- Book's sidebar search is filled, the old one outlined: leave, minor.

### Also checked

- Theme stays after reload; another business and the home page stay Luma while one is Nova (earlier check); Activate on Luma switches back with no reload.
- The demo guest cannot open Settings → Account (sent to login). That is how the demo works.

### Known differences today

- Tab switchers stay pill-shaped (`rounded-full` is not a theme value).
- Buttons have 14px corners; the old app's are 10px. Cards and dialogs match at 14px.
- The voice button in the tab bar stays indigo (brand colours).

### Not part of this plan

- The untracked `video/` folder fails the checks, as it did before this work. Looked into, not changed: 71 type errors and 94 lint errors are all in `video/src` (video scenes that use app parts with older props; the root `tsconfig.json` and ESLint include the folder). 27 failing test files are tool tests under `video/.claude/skills/` written for Node's own test runner, which vitest picks up. None come from the app. The fix is to leave `video/` out of the app's type check, lint and tests: an owner decision, as it touches another session's work.
- The demo banner's button overlaps its text at 375px in both themes.

## Legacy features (built Nov 9, not committed)

Both use Book's own data and code, and look the same way in Luma and Nova because they only use theme tokens.

### Calendar colour per team member

- `team_members.calendar_color` (migration `0070`, one new empty field). Six colours (`lib/team-rules.ts`, values in `app/globals.css`, light and dark).
- Team → edit a member → "Calendar colour": Automatic (by place in the team) or one of six. Saved through the existing member action, so only the owner can change it.
- Calendar: a dot beside each name in the column heads and on the phone list; each block has a left edge in the member's colour. The fill still shows the booking's state, and names stay visible.

### Pay outside the app

- **Off until the business adds a way to pay.** With none, the booking flow and bookings are exactly as before. Online payment code is untouched (Book has none for bookings; subscriptions are separate).
- Settings → Payments: up to 6 ways (bank transfer, Zelle, other), each with a name and instructions; a "Pay at the visit" switch.
- Booking flow: one more step, "How you'll pay", shown only when the business has ways to pay. It lists names only. The instructions show after booking, to that customer.
- A booking's payment starts **Not paid**, always. The customer can say "I've paid" (with an optional reference) from their booking: that only sets **Check payment**. Only the owner can set **Paid** (booking details → "Mark as paid" / "Mark as not paid").
- The method's name and instructions are copied onto the booking, so later edits do not change old bookings.
- Data: `payment_methods` table, `businesses.pay_later`, six `payment_*` fields on `bookings` (migration `0071`, all new, nothing existing changed).
- Code: `lib/payment-rules.ts`, `lib/payment-methods.ts`, `features/dashboard/api/payment-actions.ts`, `features/customer-account/api/report-payment.ts`, `features/booking/api/create-booking.ts`.

### Checked

- Tests run: whole suite, 2040 pass. New: payment rules (10), owner actions with business isolation (9), customer report (7), booking creation with payment, team colour rules. The only failing files are the 27 in `video/` above.
- Type check: 0 errors outside `video/`. Lint: 0 errors outside `video/`.
- Build: compiles; stops at the type check on `video/` as before.
- Browser (demo business, local database): add a Zelle method, pay-later switch, payment step at 375px in Nova, a booking made with Zelle, owner marks paid and not paid, colour picker and calendar in Luma and Nova, light and dark.

### Not checked or not built

- The customer's "Payment" block with "I've paid" (`features/customer-account/components/booking-payment.tsx`) was **not seen in a browser**: it needs a signed-in customer with a booking at a business that is not a demo. Its action is covered by tests.
- Spanish, French and Portuguese for the new words: done on Nov 10, see [follow-ups](outside-payments.md).
- Bells, the assistant, the team area and the admin: built on Nov 10, see [Pay outside the app: follow-ups](outside-payments.md). WhatsApp messages still say nothing about payment.
- Migrations `0070` and `0071` ran on this Mac's database only. The other session's `0069` sits before them in the journal.

## Needs the owner's approval

- **Commit.** The work above is not committed.
- **Go-live.** Nothing is pushed or deployed, and the live database has not been migrated. All need the owner's word in chat.
- **NV8, look questions.** Should Nova's tab switchers be squarer, and buttons 10px instead of 14px? Both need a change in how the shared parts take their corners.
- **Badge contrast (NV3).** Darken the small badge text in both themes?
- **`video/` in the checks.** Leave it out of type check, lint and tests?
- **A bookings account on Koblip Sales** for NV1, and a team account for NV4.

## Next step

1. Owner: say whether to commit.
2. Run the translation so Spanish has the new words, then do NV6.
3. See the customer's "I've paid" block in a browser with a real customer account.
4. NV1 and NV4 once the accounts exist; NV8 with the owner.
