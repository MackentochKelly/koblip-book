# Theme and dark mode

## Tokens

- Every colour lives once in `app/globals.css`: `:root` (light) and `.dark`.
- shadcn pattern, in oklch. Each surface is a pair: `--x` and
  `--x-foreground` (background, card, popover, primary, secondary, muted,
  accent, destructive, border, input, ring, chart-1…5, sidebar-*).
- **Adding a colour:** define `--x` / `--x-foreground` in `:root` and
  `.dark`, map them as `--color-x` in `@theme inline`, use `bg-x`.
- Radius from `--radius` (sm 0.6×, md 0.8×, lg 1×, xl 1.4× …).
- Never a hex colour or arbitrary px in components.

## Dark mode

- `next-themes`, `attribute="class"`, `defaultTheme="system"`,
  `disableTransitionOnChange`, `suppressHydrationWarning` on `<html>`.
- `color-scheme: light dark` so form controls and scrollbars follow.
- Follow the system by default (Apple's guidance); our toggle is extra.
- Raised surfaces (sheets, popovers, menus) are a little lighter in dark.
- Check in dark: shadows that vanish, white images, borders that disappear,
  text on brand colours.

## Contrast (measure, don't guess)

| What | Minimum |
|---|---|
| Normal text | 4.5:1 |
| Large text (24px, or 18.5px bold) | 3:1 |
| Icons, control edges, focus rings, states | 3:1 |
| Apple's aim for custom colours in dark | 7:1 |

- `muted-foreground` on `muted` is the usual weak spot: measure it.
- Light and dark each need their own check.
- `contrast-more:` can strengthen faint lines when the user asks.
- In Windows forced colours, borders must still show.
