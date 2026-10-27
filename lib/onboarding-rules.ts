export const ONBOARDING_RULES = {
  debounceMs: 250,
  maxResults: 5,
  biasRadiusMeters: 50_000,
  minInput: 2,
  maxInput: 100,
  minPasswordLength: 8,
  // An import nobody owns and nobody confirmed older than this (hours) is
  // deleted on the next prepareBusiness call.
  unclaimedImportHours: 24,
  // A sign-up verification link stays valid this long (hours).
  emailVerificationHours: 24,
} as const
