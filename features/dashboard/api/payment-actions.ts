"use server"

import { and, asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { bookings, businesses, paymentMethods } from "@/lib/db/schema"
import { clientNotification } from "@/lib/in-app-notifications"
import { policyPaymentFor } from "@/lib/payment-methods"
import { deleteProof } from "@/lib/payment-proofs"
import {
  checkPaymentMethod,
  isPaymentType,
  PAYMENT_RULES,
  withRemovedType,
} from "@/lib/payment-rules"
import { revalidateBusiness } from "@/lib/revalidate-business"
import type { ActionResult } from "../types"
import { ownedBusiness } from "./owned-business"

// Settings → Payments: the ways a business is paid outside the app
// (lib/payment-rules.ts). Every action is the owner's, on their own
// business only.

// Adds a way (methodId null) or saves one. The error names the field that
// is wrong.
export async function savePaymentMethod(
  businessId: string,
  methodId: string | null,
  input: { type: string; name: string; details: string }
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const checked = checkPaymentMethod(input)
  if (!checked.ok) return checked
  const existing = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(eq(paymentMethods.businessId, owned.business.id))
    .orderBy(asc(paymentMethods.position))
  if (methodId === null) {
    if (existing.length >= PAYMENT_RULES.maxMethods)
      return { ok: false, error: "full" }
    const id = crypto.randomUUID()
    await db.insert(paymentMethods).values({
      id,
      businessId: owned.business.id,
      ...checked.values,
      position: existing.length,
    })
    revalidateBusiness(owned.business.slug)
    return { ok: true, id }
  }
  if (!existing.some((method) => method.id === methodId))
    return { ok: false, error: "not_found" }
  await db
    .update(paymentMethods)
    .set(checked.values)
    .where(
      and(
        eq(paymentMethods.id, methodId),
        eq(paymentMethods.businessId, owned.business.id)
      )
    )
  revalidateBusiness(owned.business.slug)
  return { ok: true, id: methodId }
}

// Removes a way. Bookings already made with it keep their own copy. A
// standard way (bank transfer, Zelle, Cash App) leaves the list for good,
// not back to "Not set up", unless another way of its kind is still there.
export async function deletePaymentMethod(
  businessId: string,
  methodId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const methods = await db
    .select({ id: paymentMethods.id, type: paymentMethods.type })
    .from(paymentMethods)
    .where(eq(paymentMethods.businessId, owned.business.id))
  const method = methods.find((item) => item.id === methodId)
  if (!method) return { ok: false, error: "not_found" }
  const lastOfKind = !methods.some(
    (item) => item.id !== method.id && item.type === method.type
  )
  await saveAll([
    db
      .delete(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, method.id),
          eq(paymentMethods.businessId, owned.business.id)
        )
      ),
    ...(lastOfKind
      ? [
          db
            .update(businesses)
            .set({
              removedPaymentTypes: withRemovedType(
                owned.business.removedPaymentTypes,
                method.type
              ),
            })
            .where(eq(businesses.id, owned.business.id)),
        ]
      : []),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// Removes a standard way that was never set up from the owner's list.
export async function removePaymentType(
  businessId: string,
  type: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (!isPaymentType(type)) return { ok: false, error: "invalid" }
  await db
    .update(businesses)
    .set({
      removedPaymentTypes: withRemovedType(
        owned.business.removedPaymentTypes,
        type
      ),
    })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// Whether customers may choose to pay at the visit.
export async function setPayLater(
  businessId: string,
  payLater: boolean
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (typeof payLater !== "boolean") return { ok: false, error: "invalid" }
  await db
    .update(businesses)
    .set({ payLater })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// The owner keeps their policies as they are, after the ways to pay moved
// on: the policies now stand for today's ways, so Settings → Payments
// stops asking until those change again.
export async function keepPolicies(businessId: string): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  await db
    .update(businesses)
    .set({ policiesPayment: await policyPaymentFor(owned.business) })
    .where(eq(businesses.id, owned.business.id))
  return { ok: true }
}

// Payment pictures (docs/plans/payment-proof.md): whether a customer must
// add one to say they paid (`ask`), and whether a team member sees the
// ones on their own bookings (`team`). Pictures already sent stay.
export async function setPaymentProof(
  businessId: string,
  setting: "ask" | "team",
  on: boolean
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (typeof on !== "boolean" || (setting !== "ask" && setting !== "team"))
    return { ok: false, error: "invalid" }
  await db
    .update(businesses)
    .set(setting === "ask" ? { paymentProof: on } : { paymentProofTeam: on })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// The owner says a booking is paid, or not after all. The only way a
// booking becomes paid: a customer can only ask for it to be checked.
// Only for a booking that tracks a payment.
export async function setBookingPaid(
  businessId: string,
  bookingId: string,
  paid: boolean
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (typeof paid !== "boolean") return { ok: false, error: "invalid" }
  const [booking] = await db
    .select({
      id: bookings.id,
      paymentStatus: bookings.paymentStatus,
      paymentProof: bookings.paymentProof,
      businessId: bookings.businessId,
      moves: bookings.moves,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      customerUserId: bookings.customerUserId,
      customerKey: bookings.customerKey,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!booking) return { ok: false, error: "not_found" }
  if (booking.paymentStatus === null) return { ok: false, error: "no_payment" }
  // The client's bell hears that it is paid, saved with the change; not
  // when it was paid already, and not when it turns back to not paid.
  const turnsPaid = paid && booking.paymentStatus !== "paid"
  await saveAll([
    db
      .update(bookings)
      .set({
        paymentStatus: paid ? "paid" : "unpaid",
        paymentPaidAt: paid ? new Date().toISOString() : null,
        // Not paid after all: what the customer reported no longer stands.
        // Its picture goes too, so the customer can send a new one.
        ...(!paid && {
          paymentReference: null,
          paymentReportedAt: null,
          paymentProof: null,
        }),
      })
      .where(eq(bookings.id, booking.id)),
    ...(turnsPaid ? await clientNotification(booking, "clientPaid") : []),
  ])
  if (!paid) await deleteProof(booking.paymentProof)
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
