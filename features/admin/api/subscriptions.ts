import "server-only"

import { alias } from "drizzle-orm/sqlite-core"
import { and, asc, desc, eq, isNotNull, notExists, notInArray } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, proGrants, subscription, user } from "@/lib/db/schema"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { stripeKeys } from "@/lib/stripe"
import { ENDED_STATUSES } from "@/lib/subscription-rules"

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
  // Pro given for free by the admin (P7b), and who gave and took it back.
  grant: {
    id: number
    givenBy: string | null
    givenAt: string
    removedBy: string | null
    removedAt: string | null
  } | null
}

// A business that can get Pro for free: real, with an owner, on Free.
export interface FreeBusiness {
  id: string
  name: string
  ownerName: string
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
  const giver = alias(user, "giver")
  const remover = alias(user, "remover")
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
      grantId: proGrants.id,
      givenBy: giver.name,
      givenAt: proGrants.givenAt,
      removedBy: remover.name,
      removedAt: proGrants.removedAt,
    })
    .from(subscription)
    .innerJoin(businesses, eq(businesses.id, subscription.referenceId))
    .leftJoin(user, eq(user.id, businesses.ownerId))
    .leftJoin(proGrants, eq(proGrants.stripeSubscriptionId, subscription.stripeSubscriptionId))
    .leftJoin(giver, eq(giver.id, proGrants.givenBy))
    .leftJoin(remover, eq(remover.id, proGrants.removedBy))
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
    grant:
      row.grantId === null || row.givenAt === null
        ? null
        : {
            id: row.grantId,
            givenBy: row.givenBy,
            givenAt: row.givenAt,
            removedBy: row.removedBy,
            removedAt: row.removedAt,
          },
  }))
}

// The businesses Give Pro free can pick, by name: every real business with
// an owner and no subscription that isn't over.
export async function getFreeBusinesses(): Promise<FreeBusiness[]> {
  await requireAdmin()
  return db
    .select({ id: businesses.id, name: businesses.name, ownerName: user.name })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .where(
      and(
        eq(businesses.isDemo, false),
        notExists(
          db
            .select({ id: subscription.id })
            .from(subscription)
            .where(
              and(
                eq(subscription.referenceId, businesses.id),
                isNotNull(subscription.stripeSubscriptionId),
                notInArray(subscription.status, ENDED_STATUSES)
              )
            )
        )
      )
    )
    .orderBy(asc(businesses.name))
}
