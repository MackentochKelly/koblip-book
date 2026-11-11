import "server-only"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"

import { db } from "@/lib/db"
import { businesses, notificationSettings, user } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"
import { backToFreeEmail, paymentFailedEmail } from "@/lib/email-templates"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { businessPlan } from "@/lib/plan-access"

// What happened to a business's Pro plan that its owner hears of by email
// (docs/plans/subscriptions.md, P6).
export type BillingEmail = "paymentFailed" | "backToFree"

const TEMPLATES = { paymentFailed: paymentFailedEmail, backToFree: backToFreeEmail }

// Emails the business's owner, in the owner's language, with a link to its
// Settings → Plan. An owner who signed up by phone has no email to reach.
// Returns whether it went.
export async function sendBillingEmail(kind: BillingEmail, businessId: string): Promise<boolean> {
  const [row] = await db
    .select({
      businessName: businesses.name,
      userId: user.id,
      email: user.email,
      language: notificationSettings.ownerLanguage,
    })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerId))
    .leftJoin(notificationSettings, eq(notificationSettings.businessId, businesses.id))
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!row || isPhoneAccountEmail(row.email)) return false
  const language = row.language ?? "en"
  const content = await TEMPLATES[kind]({
    businessName: row.businessName,
    url: `${process.env.BETTER_AUTH_URL}/dashboard/${businessId}/settings/plan`,
    language,
  })
  return sendEmail(
    { to: row.email, ...content },
    { kind, userId: row.userId, businessId, language }
  )
}

// Stripe's update moved the subscription into past_due: the first charge
// that failed, not each retry after it (Smart Retries, S7).
export function paymentJustFailed(event: Stripe.Event, stripeSubscription: Stripe.Subscription) {
  const before = (event.data.previous_attributes as { status?: string } | undefined)?.status
  return stripeSubscription.status === "past_due" && before !== undefined && before !== "past_due"
}

// The Stripe plugin's subscription hooks (lib/auth.ts). An email that fails
// is logged; the webhook still succeeds, so Stripe doesn't send it again.
export const billingEmailHooks = {
  onSubscriptionUpdate: async ({
    event,
    stripeSubscription,
    subscription,
  }: {
    event: Stripe.Event
    stripeSubscription: Stripe.Subscription
    subscription: { referenceId: string }
  }) => {
    if (!paymentJustFailed(event, stripeSubscription)) return
    await sendBillingEmail("paymentFailed", subscription.referenceId).catch(console.error)
  },
  // The subscription ended (cancelled at the period's end, or unpaid after
  // the retries): back to Free, unless another paid plan still holds it.
  onSubscriptionDeleted: async ({ subscription }: { subscription: { referenceId: string } }) => {
    const businessId = subscription.referenceId
    if ((await businessPlan(businessId)) !== "free") return
    await sendBillingEmail("backToFree", businessId).catch(console.error)
  },
}
