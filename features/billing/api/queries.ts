import "server-only"
import { cache } from "react"
import { notFound } from "next/navigation"
import { and, desc, eq, isNotNull, notInArray } from "drizzle-orm"

import { requireAccount } from "@/lib/dal"
import { db } from "@/lib/db"
import { subscription } from "@/lib/db/schema"
import { businessPlan, canBillBusiness } from "@/lib/plan-access"
import type { Plan } from "@/lib/plan-features"
import { stripeClient } from "@/lib/stripe"
import { ENDED_STATUSES, PAID_PLANS, stopsAt } from "@/lib/subscription-rules"
import type { Billing, PlanPrice } from "../types"

// Pro's prices as Stripe charges them, by lookup key (S5), once per request.
const proPrices = cache(async (): Promise<Billing["prices"] | null> => {
  if (!stripeClient) return null
  const pro = PAID_PLANS[0]
  const { data } = await stripeClient.prices.list({
    lookup_keys: [pro.lookupKey, pro.annualDiscountLookupKey],
    active: true,
  })
  const price = (key: string): PlanPrice | null => {
    const found = data.find((item) => item.lookup_key === key)
    return found?.unit_amount != null
      ? { amountMinor: found.unit_amount, currency: found.currency.toUpperCase() }
      : null
  }
  const monthly = price(pro.lookupKey)
  const yearly = price(pro.annualDiscountLookupKey)
  return monthly && yearly ? { monthly, yearly } : null
})

// Settings → Plan (docs/plans/subscriptions.md, P4): the business's plan,
// its latest subscription that isn't over, and Pro's prices. Only the
// business's owner reads it; without Stripe set up there is no such page.
export async function getBilling(businessId: string): Promise<Billing> {
  const owner = await requireAccount(`/dashboard/${businessId}/settings/plan`)
  if (!(await canBillBusiness(owner.userId, businessId))) notFound()
  const [plan, prices, [current]] = await Promise.all([
    businessPlan(businessId),
    proPrices(),
    db
      .select({
        status: subscription.status,
        periodEnd: subscription.periodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelAt: subscription.cancelAt,
        billingInterval: subscription.billingInterval,
      })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, businessId),
          // The Stripe plugin saves a placeholder row when Upgrade opens
          // Checkout; only a subscription Stripe made has an id, so an
          // abandoned Checkout leaves nothing to manage.
          isNotNull(subscription.stripeSubscriptionId),
          notInArray(subscription.status, ENDED_STATUSES)
        )
      )
      .orderBy(desc(subscription.periodEnd))
      .limit(1),
  ])
  if (!prices) notFound()
  return {
    plan: plan satisfies Plan,
    subscription: current
      ? {
          status: current.status ?? "incomplete",
          endsAt: (stopsAt(current) ?? current.periodEnd)?.toISOString() ?? null,
          cancelling: stopsAt(current) !== null,
          yearly: current.billingInterval === "year",
        }
      : null,
    prices,
  }
}
