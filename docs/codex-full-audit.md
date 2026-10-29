Audit only. Do not change, commit or push anything. Write the result to
`docs/audit-2026-10-29.md` and stop.

Read `AGENTS.md` first: its UI rules (phone first, 44px touch targets,
little text, only shadcn parts from `components/ui`, theme tokens only, light
and dark) are the standard to audit against.

## What to audit

Every page, at phone size (375x812) and computer size (1280x800), in light
and dark mode, in English and Spanish:

- `/` (home), `/login`, `/dashboard`
- `/setup/[businessId]`, `/setup/[businessId]/ready`
- `/dashboard/[businessId]` (bookings), `/customers`, `/services`, `/team`,
  `/hours`, `/settings`, `/assistant` (Chat and Recent views)
- `/b/[slug]` (public business page) and `/b/[slug]/book` (booking flow,
  every step)
- Every sheet, drawer, dialog, menu and toast these pages open.

Run it locally: `npm run dev` (local database, never the live one). Use the
browser at both sizes. If a page needs a sign-in you cannot do, audit its
code instead and write "code only" next to that page.

## Checks, with the official source for each

1. **Scrolling on iPhone Safari.** The page itself (the document) should
   scroll, not a box inside it; nothing should scroll sideways
   (`document.documentElement.scrollWidth` must equal 375); only full-screen
   app views (the assistant chat) lock the page behind them. Note any box
   with `overflow: auto/scroll` that is taller than the screen, and any
   element wider than the screen.
   Sources: https://developer.mozilla.org/docs/Web/CSS/overflow ,
   https://developer.mozilla.org/docs/Web/CSS/overscroll-behavior ,
   https://developer.mozilla.org/docs/Web/API/VisualViewport
2. **Safe areas and the keyboard.** Nothing hidden under the iPhone notch,
   home bar or keyboard; fixed bars use `env(safe-area-inset-*)`.
   Source: https://developer.mozilla.org/docs/Web/CSS/env
3. **Touch targets.** Every tappable thing at least 44x44 px on a phone,
   counting the invisible tap area `components/ui/button.tsx` adds
   (`pointer-coarse:after:min-h-11`). List each one under 44 with its size.
   Source: https://developer.apple.com/design/human-interface-guidelines/accessibility
   ("Buttons and controls", 44x44 pt).
4. **Contrast, light and dark.** Text at least 4.5:1 (3:1 for large text and
   icons). Measure, don't guess.
   Source: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
5. **Dark mode.** Anything that only looks right in light: hard-coded
   colours, white or black backgrounds, images or shadows that vanish.
6. **Components and tokens.** Anything hand-built that a shadcn part in
   `components/ui` already does; any hex colour or arbitrary px value; the
   same thing built two different ways on two pages.
   Source: https://ui.shadcn.com/docs
7. **Text.** More than one short helper line on a card, English words on a
   Spanish page or the other way round, text that is cut off or wraps
   badly at 375px.
8. **States.** Loading, empty and error states on every list and form;
   buttons that do nothing or pretend to work; dead code or unused files.
9. **Errors.** Browser console errors and warnings, failed network requests,
   server log errors, on every page.
10. **Accessibility.** Buttons with only an icon have a label; dialogs trap
    focus and close with Escape; every page has one `h1`.

## Already seen (start here, confirm the cause)

- Dashboard on iPhone: a scroll bar runs from under the top bar to the
  bottom, and the cards look cut off at the right edge (right border
  missing). Find out whether the document or an inner box is scrolling,
  and what is wider than the screen.
- Assistant chat on iPhone: the page behind used to scroll and bounce.
  Commit ca1108b locks it; confirm it is fixed and nothing else broke.
- Chat/Recent tabs (`components/view-tabs.tsx`) are 27px tall and the
  "Checked N things" rows (`TraceCollapsibleTrigger`) are 20px tall, under
  44px.

## Result format (`docs/audit-2026-10-29.md`)

One table per page:

| # | Problem | Where (file:line) | Cause (one line) | Fix (one line, the proper root-cause fix, with the doc link) | Severity (high/medium/low) |

Then a "Top 10 to fix first" list, most important first. No fixes in
code, only the report. Say plainly when you are not sure of a cause.
