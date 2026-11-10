import type { PolicyPaymentState } from "@/lib/payment-rules"

// How paying really works at a business, as told to Muse so a policy never
// promises more, or less. The app takes no money in any case; what changes
// is what the business offers (policyPaymentState in lib/payment-rules.ts).
const FREE =
  "Customers book online for free; the booking page itself never takes a payment."

const NEVER_NAME =
  "Never name a specific way to pay and never give payment details: the business can change them at any time."

const FACTS: Record<PolicyPaymentState, string> = {
  visit: `${FREE} They pay the business at their visit.`,
  direct_or_visit: `${FREE} They pay the business directly: either ahead, by one of the ways the business shows when they book (a transfer, for example), or at their visit. After booking with one of those ways they see where to send the money, and tell the business once they have paid. ${NEVER_NAME}`,
  direct: `${FREE} They pay the business directly, by one of the ways the business shows when they book (a transfer, for example); paying at the visit is not offered. After booking they see where to send the money, and tell the business once they have paid. ${NEVER_NAME}`,
}

export function payingFact(state: PolicyPaymentState): string {
  return FACTS[state]
}
