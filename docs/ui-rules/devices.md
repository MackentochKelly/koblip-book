# Devices

Design at 375px, then check every size below.

| Device | Check at | Input |
|---|---|---|
| Small phone | 320x568 | Touch |
| iPhone | 375x812, 393x852, 430x932 | Touch |
| Android phone | 360x800, 412x915 | Touch |
| iPad / tablet | 768x1024, 1024x1366 | Touch, sometimes keyboard + trackpad |
| Laptop | 1280x800, 1440x900 | Mouse/trackpad, sometimes touch |
| Desktop | 1920x1080 | Mouse + keyboard |

Choose by **window size and input**, not by device name: a big phone in
landscape, an iPad in split view and a small laptop window all happen.

## Touch vs mouse

- `pointer-coarse:` = main input is a finger. Use it for bigger tap areas.
- `pointer-fine:` = mouse or trackpad.
- `any-pointer-*` / `any-hover` = any input present (touch laptops).
- Never hide an action behind hover only.

| | Touch | Mouse |
|---|---|---|
| Our minimum | 44x44px | 24x24px (WCAG AA) |
| Apple | 44pt (28pt smallest) | macOS 28pt (20pt smallest) |
| Android | 48dp | smaller allowed |
| Space between | about 12px around bordered controls, 24px around borderless | |

## iPhone (iOS 26+, Safari 26+)

Apple's Liquid Glass design: controls float, tab bar floats at the bottom
and shrinks on scroll, full-screen backgrounds run under the bars.

- **Text:** body 17pt, never under 11pt. Users can enlarge to 200%.
- **Safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)` on
  anything fixed to an edge.
- **Toolbar colour:** in practice Safari 26 tints its bars from the page
  background and ignores `theme-color` (seen in WebKit bug reports; Apple
  has not documented it). Keep the header on `bg-background`.
- **Scrolling:** Safari only shrinks its toolbar when the page itself
  scrolls. Let the document scroll; lock it only behind full-screen app
  views (the assistant chat does this).
- **Keyboard:** iOS shrinks only the visible area, not the layout, and
  ignores `interactive-widget`. Use `hooks/use-visual-viewport.ts` to keep
  bars above the keyboard.
- **Zoom:** never block zoom. Inputs under 16px text make Safari zoom in on
  focus (long-known, not documented by Apple).
- **Sheets:** medium (half) and large (full) heights, a grabber when it can
  resize, swipe down to close, ask first if there are unsaved changes, one
  sheet at a time.
- **Tab bar:** never hide it or disable its tabs; one-word labels.
- **Dark mode:** follow the system; sheets use the lighter raised surface.
- Safari 26 supports scroll-driven animations, anchor positioning,
  `text-wrap: pretty`, same-page and cross-page view transitions.

## Android (Chrome 135+)

- **Edge to edge:** pages draw under the gesture bar on phones.
- **Fixed bottom bars:** pad with `env(safe-area-max-inset-bottom)` and set
  `bottom: calc(env(safe-area-inset-bottom, 0px) - var(--safe-area-max-inset-bottom))`.
  Not `padding-bottom: env(safe-area-inset-bottom)` (jank).
- **Keyboard:** default shrinks only the visible area, like iOS.
- **Window sizes (Material 3):** compact under 600, medium 600-839,
  expanded 840-1199, large 1200-1599, extra-large 1600+.
- **Navigation by size:** bottom bar on compact, side rail/sidebar wider.
  Matches ours: bottom bar on phone, sidebar on computer.

## Tablets

- Premium Android tablets open sites in desktop mode: the layout must work
  with touch at desktop widths, so `pointer-coarse:` (not width) sets tap size.
- List + detail side by side from about 840px; one at a time below.
- iPad split view gives phone-sized windows: phone layout must still work.

## Laptops and desktops

- Content max width: `max-w-page` for pages; don't stretch forms or text
  across 1920px (see layout.md, Big screens).
- Long text about 66 characters wide (`max-w-prose` or `66ch`).
- Every screen works with keyboard only.
