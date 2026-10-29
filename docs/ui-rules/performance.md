# Performance

## Targets (Core Web Vitals, 75% of visits, phone and desktop)

| Metric | Good |
|---|---|
| LCP (main content shows) | ≤ 2.5s |
| INP (reacts to a tap) | ≤ 200ms |
| CLS (nothing jumps) | ≤ 0.1 |

## Images (`next/image`)

- Always `width` + `height`, or `fill` with a sized parent: reserves space,
  no jump.
- Always `sizes` with `fill` or responsive images, or phones download
  desktop-size files.
- The main above-the-fold image: `loading="eager"` or
  `fetchPriority="high"`. `priority` is deprecated in Next 16.

## Fonts (`next/font`)

- Self-hosted through `lib/fonts.ts`, `display: swap`, variable fonts,
  CSS variables. Never a font from a link tag.

## No jumps

- Skeletons the same size as the content they replace.
- Reserve room for toasts, banners and images.

## Quick to react

- Show something right away; skeleton for content, spinner only when the
  wait is unknown and short, progress bar when it's known.
- Optimistic updates where safe; undo or confirm for the rest.
- Heavy parts (maps, charts, Motion `domMax`) load only where used.

## Viewport metadata

- `viewport` / `generateViewport` in Server Components only.
- `themeColor` can follow light/dark, but Safari 26 ignores it; the page
  background sets the bar colour there.
