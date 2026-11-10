"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { ownBookings } from "@/lib/customer-bookings"
import { getCustomer } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import { bookings, businesses } from "@/lib/db/schema"
import { notify } from "@/lib/in-app-notifications"
import { MY_BOOKINGS_PATH } from "@/lib/my-bookings-links"
import { deleteProof, saveProof } from "@/lib/payment-proofs"
import { checkPaymentReference } from "@/lib/payment-rules"

export type ReportPaymentResult =
  | { ok: true }
  | {
      ok: false
      error:
        | "signedOut"
        | "notFound"
        | "invalid"
        // The business asks for a picture and none came.
        | "proofMissing"
        | "too_big"
        | "wrong_type"
    }

// The customer's own booking that pays the business now, with whether its
// business asks for a picture of the payment.
type OwnPayingBooking =
  | { error: "signedOut" | "notFound" }
  | {
      booking: {
        id: string
        status: "unpaid" | "reported" | "paid" | null
        proof: string | null
        asksProof: boolean
      }
    }

async function ownPayingBooking(bookingId: string): Promise<OwnPayingBooking> {
  const customer = await getCustomer()
  if (!customer) return { error: "signedOut" }
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.paymentStatus,
      proof: bookings.paymentProof,
      asksProof: businesses.paymentProof,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        eq(bookings.id, bookingId),
        ownBookings(customer),
        eq(bookings.paymentChoice, "now")
      )
    )
    .limit(1)
  return booking ? { booking } : { error: "notFound" }
}

// "I've paid" on the customer's own booking: asks the business to check.
// It never marks the booking paid; only the business does that
// (features/dashboard/api/payment-actions.ts). Works once, on a booking the
// customer chose to pay now and nobody has answered yet. Fields:
// bookingId, reference (optional) and file, the picture of the payment,
// which a business that asks for one requires
// (docs/plans/payment-proof.md, PP3).
export async function reportPayment(
  formData: FormData
): Promise<ReportPaymentResult> {
  const bookingId = formData.get("bookingId")
  if (typeof bookingId !== "string" || !bookingId)
    return { ok: false, error: "notFound" }
  const checked = checkPaymentReference(formData.get("reference"))
  if (checked === undefined) return { ok: false, error: "invalid" }
  const found = await ownPayingBooking(bookingId)
  if ("error" in found) return { ok: false, error: found.error }
  if (found.booking.status !== "unpaid") return { ok: false, error: "notFound" }

  let proof: string | null = null
  if (found.booking.asksProof) {
    const saved = await saveProof(formData.get("file"))
    if (!saved.ok) {
      return {
        ok: false,
        error: saved.error === "missing" ? "proofMissing" : saved.error,
      }
    }
    proof = saved.name
  }
  const reported = await db
    .update(bookings)
    .set({
      paymentStatus: "reported",
      paymentReference: checked,
      paymentReportedAt: new Date().toISOString(),
      paymentProof: proof,
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.paymentStatus, "unpaid")))
    .returning({
      id: bookings.id,
      businessId: bookings.businessId,
      customerName: bookings.customerName,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
    })
  const [booking] = reported
  if (!booking) {
    // Answered meanwhile: the picture just saved belongs to nothing.
    await deleteProof(proof)
    return { ok: false, error: "notFound" }
  }
  // The owner's bell hears of it; new again if the customer reports a
  // second time after a "not paid".
  await notify(
    booking.businessId,
    "customerPaid",
    {
      customerName: booking.customerName,
      serviceName: booking.serviceName,
      startAt: booking.startAt,
    },
    { dedupeKey: `paid:${booking.id}`, renew: true }
  )
  revalidatePath(MY_BOOKINGS_PATH)
  revalidatePath("/dashboard", "layout")
  return { ok: true }
}

// Replaces the picture while the business has not answered yet (PP4): a
// wrong screenshot can be put right. Once the booking is paid, the picture
// is locked. Fields: bookingId and file.
export async function replacePaymentProof(
  formData: FormData
): Promise<ReportPaymentResult> {
  const bookingId = formData.get("bookingId")
  if (typeof bookingId !== "string" || !bookingId)
    return { ok: false, error: "notFound" }
  const found = await ownPayingBooking(bookingId)
  if ("error" in found) return { ok: false, error: found.error }
  if (found.booking.status !== "reported" || !found.booking.asksProof)
    return { ok: false, error: "notFound" }
  const saved = await saveProof(formData.get("file"))
  if (!saved.ok) {
    return {
      ok: false,
      error: saved.error === "missing" ? "proofMissing" : saved.error,
    }
  }
  const replaced = await db
    .update(bookings)
    .set({ paymentProof: saved.name })
    .where(
      and(eq(bookings.id, bookingId), eq(bookings.paymentStatus, "reported"))
    )
    .returning({ id: bookings.id })
  if (replaced.length === 0) {
    await deleteProof(saved.name)
    return { ok: false, error: "notFound" }
  }
  await deleteProof(found.booking.proof)
  revalidatePath(MY_BOOKINGS_PATH)
  revalidatePath("/dashboard", "layout")
  return { ok: true }
}
