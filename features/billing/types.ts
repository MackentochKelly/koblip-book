import type { Plan } from "@/lib/plan-features"

export type PlanPrice = { amountMinor: number; currency: string }

// What Settings → Plan shows (features/billing/api/queries.ts).
export type Billing = {
  plan: Plan
  // The latest subscription that isn't over, as Stripe reports it.
  subscription: {
    status: string
    endsAt: string | null
    cancelling: boolean
    yearly: boolean
  } | null
  prices: { monthly: PlanPrice; yearly: PlanPrice }
}
