# Nova theme

A business can pick a second look, Nova, in Settings → Theme. Nova is the look of the old bookings screens in Koblip Sales (shadcn's Nova style). This plan is the handoff for what is left.

**Status (Nov 9):** Built and committed on `after-hackathon` as `4aee17ae`. Not pushed, not deployed. Every business is still on Luma. This file itself is not committed yet, and is not in the [plans list](README.md) yet.

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

| ID | Task | Done when | Status |
| --- | --- | --- | --- |
| NV1 | Compare with the real old screens. Open Koblip Sales' Bookings (Home, Calendar, Services, Team, Booking page) signed in as a bookings account, next to Book in Nova. Nobody has seen them yet; Nova was built from the stylesheets. | A short list of visible differences is written here, each marked "fix" or "leave (layout, out of scope)" | To do |
| NV2 | Dialogs, sheets, drawers, menus, selects, date picker and the calendar view under Nova, light and dark | Each opens in Nova with readable text, a visible focus ring, and lines that show | To do |
| NV3 | Contrast under Nova, light and dark, measured | Text 4.5:1, large text and control edges 3:1 (`docs/ui-rules/checklist.md`) | To do |
| NV4 | Team area under Nova (`/team/<memberId>`) | It wears the business's theme, and Luma for a Luma business | To do |
| NV5 | Computer widths (1280 and 1920) and 320px, both themes | No sideways scroll, sidebar and page read well, nothing cut off | To do |
| NV6 | Spanish in the owner area | "Preview" and "Stop preview" show in Spanish, nothing cut off in the row at 375px | To do |
| NV7 | Luma regression pass on the main screens (home, bookings, services, team, settings, public page, booking flow) | No visible change from before `4aee17ae` | To do |
| NV8 | Decide the open look questions with the owner (below), then apply | Owner's answers logged under Decisions | Needs the owner |
| NV9 | Add this plan to `docs/plans/README.md` and commit it | Listed, committed, not pushed | To do |

### Known differences today

- Tab switchers stay pill-shaped (`rounded-full` is not a theme value).
- Buttons have 14px corners; the old app's are 10px. Cards and dialogs match at 14px.
- The voice button in the tab bar stays indigo (brand colours).

### Not part of this plan

- The build's type check fails on the untracked `video/` folder, and 27 test files in it fail. Both were there before this work.
- The demo banner's button overlaps its text at 375px in both themes.

## Needs the owner's approval

- **Go-live.** Nothing is pushed or deployed. Both need the owner's word in chat.
- **NV8, look questions.** Should Nova's tab switchers be squarer, and buttons 10px instead of 14px? Both need a change in how the shared parts take their corners.
- **Legacy features below.** Proposed only.

## Proposed legacy features (awaiting approval, do not build)

Each would be its own plan, and must work the same in Luma and Nova.

| Feature | What it is | Impact | Rough effort |
| --- | --- | --- | --- |
| Pay outside the app | The business lists ways to pay (bank transfer, Zelle, others) and "pay later"; a booking shows unpaid, reported or paid. The app never moves money. | New fields on bookings and settings (a migration), a step in the booking flow, owner settings, booking details, messages | 4–6 days |
| Calendar colour per team member | Each team member's bookings get their own colour on the calendar | Calendar and a few colour values only | About 1 day |

## Next step

Start with NV1: it is the only way to know how close Nova is to the old screens. Then NV2 to NV7 in order, and bring NV8 to the owner with the NV1 list.
