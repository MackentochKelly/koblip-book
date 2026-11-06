"use server"

import { and, eq, isNotNull, isNull, notInArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businesses, proGrants, subscription, user } from "@/lib/db/schema"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { runInTurn } from "@/lib/run-in-turn"
import { stripeClient } from "@/lib/stripe"
import { ENDED_STATUSES, FREE_PRO_COUPON, PAID_PLANS } from "@/lib/subscription-rules"

export type GrantResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "has_plan" | "no_owner" | "failed" }

const PAGE = "/admin/subscriptions"

// Give a business Pro for free (docs/plans/subscriptions.md, P7b): a real
// monthly Pro subscription in Stripe with the 100% coupon, so it renews at
// $0, shows in Stripe and in the owner's billing portal, and ends like any
// other. Only for a real business with an owner and no subscription yet.
export async function giveFreePro(businessId: string): Promise<GrantResult> {
  const session = await requireAdmin()
  if (!stripeClient || typeof businessId !== "string") return { ok: false, error: "invalid" }
  // One at a time per business: a second click waits, then finds the plan.
  return runInTurn(`free-pro:${businessId}`, () => give(session.userId, businessId))
}

async function give(adminId: string, businessId: string): Promise<GrantResult> {
  if (!stripeClient) return { ok: false, error: "invalid" }
  const [business] = await db
    .select({
      id: businesses.id,
      isDemo: businesses.isDemo,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      stripeCustomerId: user.stripeCustomerId,
    })
    .from(businesses)
    .leftJoin(user, eq(user.id, businesses.ownerId))
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.isDemo) return { ok: false, error: "invalid" }
  if (!business.ownerId) return { ok: false, error: "no_owner" }
  const [live] = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, businessId),
        isNotNull(subscription.stripeSubscriptionId),
        notInArray(subscription.status, ENDED_STATUSES)
      )
    )
    .limit(1)
  if (live) return { ok: false, error: "has_plan" }

  const pro = PAID_PLANS[0]
  // The row first, named in the subscription's metadata as the Stripe plugin
  // does, so its webhooks update this row instead of making a second one.
  const rowId = crypto.randomUUID()
  await db.insert(subscription).values({
    id: rowId,
    plan: pro.name,
    referenceId: businessId,
    status: "incomplete",
  })
  try {
    const customer = business.stripeCustomerId ?? (await newCustomer(business))
    const { data: prices } = await stripeClient.prices.list({
      lookup_keys: [pro.lookupKey],
      active: true,
    })
    if (!prices[0]) throw new Error(`No active price for ${pro.lookupKey}`)
    const created = await stripeClient.subscriptions.create(
      {
        customer,
        items: [{ price: prices[0].id }],
        discounts: [{ coupon: FREE_PRO_COUPON }],
        metadata: {
          userId: business.ownerId,
          subscriptionId: rowId,
          referenceId: businessId,
        },
      },
      { idempotencyKey: `free-pro-${rowId}` }
    )
    const item = created.items.data[0]
    await saveAll([
      db
        .update(subscription)
        .set({
          stripeCustomerId: customer,
          stripeSubscriptionId: created.id,
          status: created.status,
          periodStart: new Date(item.current_period_start * 1000),
          periodEnd: new Date(item.current_period_end * 1000),
          billingInterval: item.price.recurring?.interval,
        })
        .where(eq(subscription.id, rowId)),
      db.insert(proGrants).values({
        businessId,
        stripeSubscriptionId: created.id,
        givenBy: adminId,
      }),
    ])
  } catch (error) {
    console.error(error)
    await db
      .delete(subscription)
      .where(and(eq(subscription.id, rowId), isNull(subscription.stripeSubscriptionId)))
    return { ok: false, error: "failed" }
  }
  revalidatePath(PAGE)
  return { ok: true }
}

// The owner's Stripe customer, made the way the Stripe plugin makes one
// (metadata userId and customerType), so its webhooks find the owner. A
// phone sign-up has no real email to give Stripe.
async function newCustomer(owner: {
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string | null
}): Promise<string> {
  if (!stripeClient || !owner.ownerId) throw new Error("No Stripe or owner")
  const customer = await stripeClient.customers.create({
    name: owner.ownerName ?? undefined,
    email:
      owner.ownerEmail && !isPhoneAccountEmail(owner.ownerEmail) ? owner.ownerEmail : undefined,
    metadata: { userId: owner.ownerId, customerType: "user" },
  })
  await db
    .update(user)
    .set({ stripeCustomerId: customer.id })
    .where(eq(user.id, owner.ownerId))
  return customer.id
}

// Take a free Pro back: the subscription ends now in Stripe, the business
// is on Free again, and the grant records who ended it.
export async function removeFreePro(grantId: number): Promise<GrantResult> {
  const session = await requireAdmin()
  if (!stripeClient || !Number.isInteger(grantId)) return { ok: false, error: "invalid" }
  return runInTurn(`free-pro-grant:${grantId}`, () => remove(session.userId, grantId))
}

async function remove(adminId: string, grantId: number): Promise<GrantResult> {
  if (!stripeClient) return { ok: false, error: "invalid" }
  const [grant] = await db
    .select({ stripeSubscriptionId: proGrants.stripeSubscriptionId })
    .from(proGrants)
    .where(and(eq(proGrants.id, grantId), isNull(proGrants.removedAt)))
    .limit(1)
  if (!grant) return { ok: false, error: "invalid" }
  try {
    const ended = await stripeClient.subscriptions.cancel(grant.stripeSubscriptionId)
    await saveAll([
      db
        .update(subscription)
        .set({
          status: ended.status,
          canceledAt: ended.canceled_at ? new Date(ended.canceled_at * 1000) : new Date(),
          endedAt: ended.ended_at ? new Date(ended.ended_at * 1000) : new Date(),
        })
        .where(eq(subscription.stripeSubscriptionId, grant.stripeSubscriptionId)),
      db
        .update(proGrants)
        .set({ removedBy: adminId, removedAt: new Date().toISOString() })
        .where(eq(proGrants.id, grantId)),
    ])
  } catch (error) {
    console.error(error)
    return { ok: false, error: "failed" }
  }
  revalidatePath(PAGE)
  return { ok: true }
}
