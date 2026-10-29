# UI rules

The rule book for every screen in Koblip Book. Read it before a UI change,
check against it when done.

Last checked against the sources: **2026-10-29**. Re-check the sources every
3 months, or when a new iOS, Safari, WCAG or shadcn release lands, and update
the date.

## How to use

1. **Before:** read [checklist.md](checklist.md) and the topic file for the
   change. Look for a shared part or a ready-made component first
   ([components.md](components.md)).
2. **Build:** phone first (375px), then tablet and computer.
3. **After:** walk the checklist again, light and dark, phone and computer,
   English and Spanish. Nothing is done until every line passes.

## Files

| File | What it covers |
|---|---|
| [checklist.md](checklist.md) | The short pass/fail list for every change |
| [accessibility.md](accessibility.md) | WCAG 2.2 AA, laws, keyboard patterns, user settings |
| [devices.md](devices.md) | iPhone/Safari, Android/Chrome, iPad, laptops, desktops |
| [layout.md](layout.md) | Responsive layout, breakpoints, modern CSS |
| [theme.md](theme.md) | Colours, tokens, dark mode, contrast |
| [motion.md](motion.md) | Animations, transitions, reduced motion |
| [components.md](components.md) | Shared parts, shadcn, ready-made registries |
| [forms-and-text.md](forms-and-text.md) | Forms on phones, little text, Spanish |
| [performance.md](performance.md) | Speed, images, fonts, layout shift |
| [sources.md](sources.md) | Every official source, with its date |

## Our standard in one line

WCAG 2.2 AA everywhere, plus our house rules: 44px tap areas on touch
screens, phone first, only shared shadcn parts, only theme tokens, little
text, light and dark.

## Known gaps (found while writing this, not fixed yet)

- shadcn now ships its own Toast (built on Base UI); we still use Sonner,
  which still works. Decide before adding new toast code.
