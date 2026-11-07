// The prices shown on the home page: the same as Pro's prices in Stripe
// (lib/subscription-rules.ts, O1), before tax. Free stays free (O3).
export const PRICING_RULES = {
  currency: "USD",
  freePriceMinor: 0,
  proPriceMinor: 1900,
  proYearlyPriceMinor: 19000,
} as const
