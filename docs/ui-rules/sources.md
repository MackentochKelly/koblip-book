# Sources

Official sources only, opened and checked on 2026-10-29. Dates are each
page's own "updated" date. Re-check every 3 months.

## Accessibility

- WCAG 2.2 (Rec, 12 Dec 2024): https://www.w3.org/TR/WCAG22/
- WCAG overview (17 Sep 2026): https://www.w3.org/WAI/standards-guidelines/wcag/
- WCAG 2.2 errata (1 Oct 2026): https://www.w3.org/WAI/WCAG22/errata/
- WCAG 3.0 draft (10 Sep 2026): https://www.w3.org/TR/wcag-3.0/
- Target size minimum (11 May 2026): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Contrast minimum (6 Sep 2026): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WAI-ARIA 1.2: https://www.w3.org/TR/wai-aria/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- EN 301 549 V4.1.1 (NDA Ireland): https://nda.ie/news/en301549-published
- ADA Title II rule (20 Apr 2026): https://www.federalregister.gov/documents/2026/04/20/2026-07663/
- ADA first steps: https://www.ada.gov/resources/web-rule-first-steps/
- Section 508: https://www.access-board.gov/ict/
- axe-core 4.14: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
- Lighthouse scoring (22 Oct 2025): https://developer.chrome.com/docs/lighthouse/accessibility/scoring
- Android accessibility testing (23 Oct 2026): https://developer.android.com/guide/topics/ui/accessibility/testing

## Apple

- HIG Accessibility (9 Jun 2025): https://developer.apple.com/design/human-interface-guidelines/accessibility
- HIG Typography (16 Dec 2025): https://developer.apple.com/design/human-interface-guidelines/typography
- HIG Layout (9 Sep 2026): https://developer.apple.com/design/human-interface-guidelines/layout
- HIG Tab bars (8 Jun 2026): https://developer.apple.com/design/human-interface-guidelines/tab-bars
- HIG Sheets (24 Mar 2026): https://developer.apple.com/design/human-interface-guidelines/sheets
- HIG Motion (9 Sep 2025): https://developer.apple.com/design/human-interface-guidelines/motion
- HIG Dark Mode (6 Aug 2024): https://developer.apple.com/design/human-interface-guidelines/dark-mode
- HIG Loading (9 Jun 2025): https://developer.apple.com/design/human-interface-guidelines/loading
- Safari 26 release notes (15 Sep 2025): https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes
- WebKit Safari 26 (9 Jun 2025): https://webkit.org/blog/16993/
- WebKit Safari 26.6 (27 Jul 2026): https://webkit.org/blog/18178/
- WebKit Safari 27 beta (8 Jun 2026): https://webkit.org/blog/17967/
- WebKit cross-page view transitions: https://webkit.org/blog/16967/

The HIG pages need JavaScript; Apple's JSON copies are at
`developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`.

## Google / Android / Chrome

- Window size classes: https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- Canonical layouts: https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts
- Adaptive navigation (22 Oct 2026): https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation
- Android accessibility: https://developer.android.com/guide/topics/ui/accessibility/apps
- M3 motion: https://m3.material.io/styles/motion/overview/how-it-works
- M3 motion tokens: https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md
- Chrome edge-to-edge (28 Feb 2025): https://developer.chrome.com/docs/css-ui/edge-to-edge
- Chrome keyboard and viewport: https://developer.chrome.com/blog/viewport-resize-behavior
- Core Web Vitals: https://web.dev/articles/vitals
- Animations guide: https://web.dev/articles/animations-guide
- Forms: https://web.dev/learn/forms
- Autofill: https://web.dev/learn/forms/autofill
- Typography: https://web.dev/learn/design/typography

## MDN

- Viewport meta (23 Sep 2026): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
- `pointer` (20 Apr 2026): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer
- `prefers-reduced-transparency` (20 Apr 2026): https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency
- `color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
- `overflow`: https://developer.mozilla.org/en-US/docs/Web/CSS/overflow
- `overscroll-behavior`: https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior
- `env()`: https://developer.mozilla.org/en-US/docs/Web/CSS/env
- Intl: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl

## Our stack

- Tailwind 4.3 responsive: https://tailwindcss.com/docs/responsive-design
- Tailwind variants: https://tailwindcss.com/docs/hover-focus-and-other-states
- Tailwind dark mode: https://tailwindcss.com/docs/dark-mode
- Tailwind theme: https://tailwindcss.com/docs/theme
- shadcn docs: https://ui.shadcn.com/docs
- shadcn theming: https://ui.shadcn.com/docs/theming
- shadcn dark mode (Next): https://ui.shadcn.com/docs/dark-mode/next
- shadcn CLI: https://ui.shadcn.com/docs/cli
- shadcn registries list: https://ui.shadcn.com/r/registries.json
- Base UI: https://base-ui.com
- Motion accessibility: https://motion.dev/docs/react-accessibility
- Motion bundle size: https://motion.dev/docs/react-reduce-bundle-size
- Motion performance: https://motion.dev/docs/performance
- AnimatePresence: https://motion.dev/docs/react-animate-presence
- Next.js bundled docs: `node_modules/next/dist/docs/` (images, fonts,
  generate-viewport, view-transitions)

## Not confirmed by an official source

Treat as "known behaviour", re-check when Apple documents it:

- Safari 26 ignoring `theme-color` and tinting bars from the page background
  (WebKit bugs 301756, 302272, 305546).
- Inputs under 16px making iPhone Safari zoom on focus.
- Exact Spanish text growth (W3C gives growth by length, not by language).
