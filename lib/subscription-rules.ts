// App subscriptions (docs/plans/subscriptions.md).

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

// Subscriptions that are over: nothing left to manage
// (docs.stripe.com/billing/subscriptions/overview#subscription-statuses).
export const ENDED_STATUSES = ["canceled", "incomplete_expired"]

// The 100% coupon, forever, on Pro only, that the admin's free Pro uses
// (P7b). Made in Stripe under this id (docs/billing.md).
export const FREE_PRO_COUPON = "koblip_pro_free"

// When a subscription that is still running stops, or null when it renews.
// Stripe marks a cancel at the period's end with cancel_at_period_end, or,
// in the newer billing mode the customer portal uses, with cancel_at
// (docs.stripe.com/billing/subscriptions/billing-mode/compare).
export function stopsAt(subscription: {
  cancelAtPeriodEnd: boolean | null
  cancelAt: Date | null
  periodEnd: Date | null
}): Date | null {
  if (subscription.cancelAt) return subscription.cancelAt
  return subscription.cancelAtPeriodEnd ? subscription.periodEnd : null
}
