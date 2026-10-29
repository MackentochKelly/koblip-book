# Layout

Tailwind CSS 4.3, mobile first.

## Breakpoints

| Prefix | From | Typical |
|---|---|---|
| (none) | 0 | Phone: write this first |
| `sm:` | 640px | Big phone landscape |
| `md:` | 768px | Tablet portrait; our sidebar starts here |
| `lg:` | 1024px | Tablet landscape, laptop |
| `xl:` | 1280px | Laptop |
| `2xl:` | 1536px | Desktop |

- `sm:` means "640px and up", never "small screens".
- `max-md:` means "under 768px". Ranges: `md:max-xl:`.
- New breakpoints only in `@theme` (`--breakpoint-*`), in rem.

## Container queries first for parts

A shared part should fit its box, not the screen: mark the parent
`@container` and use `@sm:`, `@md:` … on children. Sizes: `@xs` 20rem,
`@sm` 24rem, `@md` 28rem, `@lg` 32rem, `@xl` 36rem, `@2xl` 42rem.

## Our layout rules

- Owner area: bottom tab bar on phone, sidebar on computer; panels open as
  sheets/drawers (`ResponsivePanel`, `BottomPanel`).
- The page (document) scrolls; only full-screen app views lock it.
- Never a box taller than the screen with its own scroll on a phone.
- Tabs: always `ViewTabs`.
- Heights: `svh` for stable full-screen heights (`dvh` changes while
  scrolling and can jank). Plain `vh` = the largest size on phones.

## Modern CSS we can use (Baseline status, Oct 2026)

| Feature | Status | Use |
|---|---|---|
| Container queries | Widely available | Yes |
| `svh` / `lvh` / `dvh` | Widely available | Yes |
| `:has()` | Widely available | Yes |
| Subgrid | Widely available | Yes |
| `text-wrap: balance / pretty` | Widely available (parts vary) | Headings: `text-balance`; paragraphs: `text-pretty` |
| `@starting-style` (`starting:`) | Baseline | Enter animations |
| `color-scheme` | Widely available | Yes |
| Same-page view transitions | Newly available (Oct 2025) | Yes, with fallback |
| Anchor positioning | Newly available (Jan 2026) | Let Base UI do it |
| `field-sizing: content` | Newly available (Jun 2026) | OK with fallback |
| `interpolate-size` | Not Baseline | No |
| Cross-page view transitions | Not in Firefox | Optional extra only |

## Text direction ready

Use logical sides: `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-` instead of
left/right when it's about reading direction.
