export const ACCOUNT_RULES = {
  // Deleting an account needs a login at most this old (hours); older, the
  // owner logs in again first. Better Auth's session freshAge, so its other
  // sensitive steps use the same.
  freshLoginHours: 24,
} as const
