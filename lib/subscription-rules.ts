// App subscriptions (docs/plans/subscriptions.md).
export const SUBSCRIPTION_RULES = {
  // False until businesses can pay: every business counts as on the
  // top plan, so no feature is locked yet, whatever Admin → Plans says.
  billingLive: false,
} as const

// The paid plans Better Auth's Stripe plugin sells
// (better-auth.com/docs/plugins/stripe#plan-configuration). Each name is a
// plan in lib/plan-features.ts; the prices live in Stripe under these
// lookup keys (S5), $19 a month or $190 a year (O1). No free trial (S13).
export const PAID_PLANS = [
  {
    name: "pro",
    lookupKey: "koblip_pro_monthly",
    annualDiscountLookupKey: "koblip_pro_yearly",
  },
] as const
