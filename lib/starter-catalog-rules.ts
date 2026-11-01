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
  // The least time each "Getting your page ready" row shows as working
  // (ms), one row at a time; a row whose real work takes longer waits for
  // it. Longer for what Muse writes or draws more of.
  revealMs: {
    services: 3000,
    extras: 2000,
    prices: 1500,
    team: 2000,
    photos: 3500,
    policies: 3000,
    spanish: 2500,
  },
  // After the last row, before the success page opens (ms).
  revealDoneMs: 1000,
  // How long a finished setup job's result is kept for the setup screen (ms).
  jobKeepMs: 15 * 60_000,
} as const
