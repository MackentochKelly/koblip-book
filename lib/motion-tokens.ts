// Motion's timings, from docs/ui-rules/motion.md (Material 3 tokens), for
// Motion (motion.dev) transitions; CSS uses the ease-standard token.

// The standard curve, for most moves.
export const EASE_STANDARD = [0.2, 0, 0, 1] as const

// Something changing place or size on the page (a header shrinking into
// a pill, a list opening one of its rows): 350ms on the standard curve.
export const LAYOUT_MOVE = { duration: 0.35, ease: EASE_STANDARD } as const

// A small fade, like a tip or a row's look changing: 150ms.
export const SMALL_FADE = { duration: 0.15, ease: EASE_STANDARD } as const
