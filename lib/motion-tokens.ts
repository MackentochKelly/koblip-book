import type { TargetAndTransition } from "motion/react"

// Motion's timings, from docs/ui-rules/motion.md (Material 3 tokens), for
// Motion (motion.dev) transitions; CSS uses the ease-standard token.

// The standard curve, for most moves.
export const EASE_STANDARD = [0.2, 0, 0, 1] as const

// Something changing place or size on the page (a header shrinking into
// a pill, a list opening one of its rows): 350ms on the standard curve.
export const LAYOUT_MOVE = { duration: 0.35, ease: EASE_STANDARD } as const

// A large change, like a card unfolding in a list: 500ms on the standard
// curve.
export const LARGE_MOVE = { duration: 0.5, ease: EASE_STANDARD } as const

// Something fading in while a large change runs: 300ms.
export const FADE_IN = { duration: 0.3, ease: EASE_STANDARD } as const

// A small fade, like a tip or a row's look changing: 150ms.
export const SMALL_FADE = { duration: 0.15, ease: EASE_STANDARD } as const

// A short shake that points to the one thing to tap (a rotate, so it moves
// nothing around it): after the window opening it sits in (300ms), three
// 500ms shakes 1s apart, done in under 5s (docs/ui-rules/motion.md). Reduce
// Motion turns it off (MotionConfig reducedMotion="user").
export const NUDGE: TargetAndTransition = {
  rotate: [0, -4, 4, -3, 3, 0],
  transition: {
    delay: 0.3,
    duration: 0.5,
    repeat: 2,
    repeatDelay: 1,
    ease: EASE_STANDARD,
  },
}
