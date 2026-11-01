export const ONBOARDING_RULES = {
  debounceMs: 250,
  maxResults: 5,
  biasRadiusMeters: 50_000,
  minInput: 2,
  maxInput: 100,
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
