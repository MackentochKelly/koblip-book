# Motion

Animate with a purpose: show where something came from, confirm an action,
or guide the eye. Never decoration that slows people down.

## Rules

- Animate only `transform` (move, scale, rotate) and `opacity`. Never
  `top`, `left`, `width`, `height`, padding: they re-layout every frame.
- Short, interruptible, never makes people wait.
- Follow the gesture: what slides in from the bottom leaves to the bottom.
- Never the only signal: also change text, icon or colour.
- Nothing that moves by itself for over 5s without a way to stop it.
- `will-change` almost never.

## Timing (Material 3 tokens)

| Use | Duration |
|---|---|
| Hover, press, small fades | 100-150ms |
| Menus, tooltips, toggles | 150-200ms |
| Sheets, drawers, dialogs | 250-350ms |
| Page or large changes | 400-500ms |

| Curve | Value | Use |
|---|---|---|
| Standard | `cubic-bezier(0.2, 0, 0, 1)` | Most moves |
| Decelerate (enter) | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Things coming in |
| Accelerate (exit) | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Things leaving |

Springs (Material 3 Expressive): position/size may bounce a little,
colour/opacity never bounce. shadcn and Base UI parts already have their
timings: keep them.

## Reduce Motion

- CSS/Tailwind: put movement behind `motion-safe:`; `motion-reduce:` to
  swap a slide for a fade.
- Motion (motion.dev): wrap the app in `<MotionConfig reducedMotion="user">`
  (turns off movement, keeps fades). `useReducedMotion()` to stop autoplay,
  parallax, confetti.
- Our own canvas/animation hooks use `useReducedMotion` from
  `hooks/use-theme-colors.ts`.
- Apple: with Reduce Motion, fades instead of slides or zooms, no blur or
  depth animation.

## Motion (motion.dev) v14

- Small bundles: `LazyMotion` + `m` from `motion/react-m` (about 5kb), load
  `domAnimation` (+24kb) or `domMax` (+38kb, drag and layout) only when needed.
- `AnimatePresence`: stays mounted, the condition goes inside, each child a
  stable `key` (never the array index).
- Prefer CSS / `tw-animate-css` / shadcn's built-in animations for simple
  enters and exits; Motion for gestures, layout and springs.

## View transitions

- React `<ViewTransition>` works in Next 16 with no config; it animates
  only inside transitions (route changes, `Suspense`, `startTransition`).
- `<Link transitionTypes={[...]}>` for direction.
- Browsers without support just skip it.
- Reduced motion: set `::view-transition-*(*)` `animation-duration: 0s`
  under `prefers-reduced-motion`; crossfades are safer than slides.
- Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`
  first.
