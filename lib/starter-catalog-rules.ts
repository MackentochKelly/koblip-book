// A new business's first services, extras, prices and team, written by
// Meta AI from its Google details (features/starter-catalog).
export const STARTER_CATALOG_RULES = {
  minServices: 4,
  maxServices: 6,
  minExtras: 3,
  maxExtras: 4,
  teamSize: 3,
  // Tries per catalog: a failed check is sent back with its reasons.
  attempts: 2,
  textTimeoutMs: 45_000,
  // Each team photo; Muse Image bills per picture.
  imageTimeoutMs: 60_000,
  imageSize: "1024x1024",
  // How long each finished row stays before the next one starts (ms), so
  // the owner can see what was added.
  revealMs: 450,
} as const
