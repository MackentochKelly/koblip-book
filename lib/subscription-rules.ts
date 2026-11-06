// App subscriptions (docs/plans/subscriptions.md).
export const SUBSCRIPTION_RULES = {
  // False until businesses can pay (P1): every business counts as on the
  // top plan, so no feature is locked yet, whatever Admin → Plans says.
  billingLive: false,
} as const
