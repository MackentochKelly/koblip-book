"use server"

import { eq } from "drizzle-orm"

import { getSession } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { checkOnlinePay } from "@/lib/payment-rules"
import { hasFeature } from "@/lib/plan-access"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { connectStripe } from "@/lib/stripe-connect"
import type { ActionResult } from "../types"
import { ownedBusiness } from "./owned-business"

// Settings → Payments → Card payments (docs/plans/online-payments.md).
// Every action is the owner's, on their own real business, on a plan that
// has online payments.
async function ownedForCards(businessId: string) {
  const owned = await ownedBusiness(businessId)
  if (!owned || owned.business.isDemo) return null
  if (!(await hasFeature(owned.business.id, "onlinePayments"))) return null
  return owned
}

// Starts or continues connecting the business's own Stripe account: the
// address of Stripe's pages to send the owner to. "country": Stripe takes
// no card payments where the business is.
export async function connectStripeAccount(
  businessId: string
): Promise<ActionResult<{ url: string }>> {
  const owned = await ownedForCards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const session = await getSession()
  if (!session?.email) return { ok: false, error: "email" }
  const page = `${process.env.BETTER_AUTH_URL}/dashboard/${owned.business.id}/settings/payments`
  const result = await connectStripe(owned.business, session.email, {
    back: `${page}?stripe=back`,
    again: `${page}?stripe=again`,
  })
  if (!result.ok) revalidateBusiness(owned.business.slug)
  return result
}

// What customers pay by card when they book: off, a deposit (a percent or
// an amount in hundredths), or the full price (ON5). Anything but off
// needs the Stripe account first.
export async function saveOnlinePay(
  businessId: string,
  input: { mode: string; type?: string; value?: number }
): Promise<ActionResult> {
  const owned = await ownedForCards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const checked = checkOnlinePay(input, owned.business.currency)
  if (!checked.ok) return checked
  const pay = checked.pay
  if (pay && !owned.business.stripeAccountId)
    return { ok: false, error: "not_connected" }
  await db
    .update(businesses)
    .set(
      pay?.mode === "deposit"
        ? { onlinePay: "deposit", depositType: pay.type, depositValue: pay.value }
        : // Off or full: the last deposit stays, for the next time.
          { onlinePay: pay ? "full" : "off" }
    )
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
