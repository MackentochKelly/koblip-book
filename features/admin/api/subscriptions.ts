import "server-only"

import { desc, eq, isNotNull } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, subscription, user } from "@/lib/db/schema"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { stripeKeys } from "@/lib/stripe"

// Every list stops here; the newest come first.
const MAX_ROWS = 200

export interface AdminSubscription {
  id: string
  businessName: string
  ownerName: string | null
  ownerEmail: string | null
  plan: string
  status: string
  yearly: boolean
  // When the period renews, or the subscription stops or stopped.
  periodEnd: string | null
  cancelling: boolean
  endedAt: string | null
  // The subscription and its customer in Stripe's Dashboard.
  stripeUrl: string
  customerUrl: string | null
}

// Stripe's Dashboard links (docs.stripe.com/dashboard/basics): test-mode
// objects live under /test.
export function dashboardUrl(path: string, secretKey = stripeKeys?.secretKey) {
  const test = secretKey?.startsWith("sk_test_") ? "test/" : ""
  return `https://dashboard.stripe.com/${test}${path}`
}

// Admin → Subscriptions (docs/plans/subscriptions.md, P7): every
// subscription Stripe made, live and ended, so each business's history
// shows. The Stripe plugin's placeholder rows (an abandoned Checkout) have
// no Stripe id and are left out.
export async function getSubscriptions(): Promise<AdminSubscription[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      plan: subscription.plan,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      endedAt: subscription.endedAt,
      businessName: businesses.name,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(subscription)
    .innerJoin(businesses, eq(businesses.id, subscription.referenceId))
    .leftJoin(user, eq(user.id, businesses.ownerId))
    .where(isNotNull(subscription.stripeSubscriptionId))
    .orderBy(desc(subscription.periodStart))
    .limit(MAX_ROWS)
  return rows.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail && !isPhoneAccountEmail(row.ownerEmail) ? row.ownerEmail : null,
    plan: row.plan,
    status: row.status ?? "incomplete",
    yearly: row.billingInterval === "year",
    periodEnd: row.periodEnd?.toISOString() ?? null,
    cancelling: row.cancelAtPeriodEnd ?? false,
    endedAt: row.endedAt?.toISOString() ?? null,
    stripeUrl: dashboardUrl(`subscriptions/${row.stripeSubscriptionId}`),
    customerUrl: row.stripeCustomerId ? dashboardUrl(`customers/${row.stripeCustomerId}`) : null,
  }))
}
