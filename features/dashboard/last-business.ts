// The business the owner last opened, so /dashboard (every login) opens it
// again. Not a secret: /dashboard checks it is still theirs.
export const LAST_BUSINESS_COOKIE = "koblip_last_business"
// A year, in seconds.
export const LAST_BUSINESS_MAX_AGE = 365 * 24 * 3600
