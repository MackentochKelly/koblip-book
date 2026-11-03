export const ONBOARDING_RULES = {
  debounceMs: 250,
  maxResults: 5,
  biasRadiusMeters: 50_000,
  // The browser's location for "Near me" (PositionOptions,
  // developer.mozilla.org/docs/Web/API/Geolocation/getCurrentPosition): one
  // read in the last 10 minutes is reused; a new one gets 10 seconds.
  locationMaxAgeMs: 600_000,
  locationTimeoutMs: 10_000,
  // A location already allowed that takes longer than this opens the
  // "Search near" panel, so the wait shows and a city can be picked.
  locationPanelDelayMs: 600,
  minInput: 2,
  maxInput: 100,
  // Home search text width at 375px: 219px in Inter 16px. A measured
  // 26-character sample fits; 27 does not. A stand-in for width, since
  // tests cannot measure pixels; wider letters still need a browser check.
  maxHintLength: 26,
  minPasswordLength: 8,
  // Better Auth's default maximum, set explicitly so the form's words match.
  maxPasswordLength: 128,
  // How long each Google Maps detail shows as working after sign-up (ms),
  // one at a time: quick for a plain field, longer for more to look at.
  revealMs: {
    name: 1000,
    category: 1300,
    address: 1600,
    phone: 1200,
    hours: 2000,
    photos: 5000,
    rating: 1500,
    about: 3200,
  },
  // After the last detail, before "Check your details" opens (ms).
  revealDoneMs: 1200,
  // An import nobody owns and nobody confirmed older than this (hours) is
  // deleted on the next prepareBusiness call.
  unclaimedImportHours: 24,
  // A sign-up verification link stays valid this long (hours).
  emailVerificationHours: 24,
} as const
