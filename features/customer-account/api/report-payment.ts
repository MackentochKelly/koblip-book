"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { ownBookings } from "@/lib/customer-bookings"
import { getCustomer } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { notify } from "@/lib/in-app-notifications"
import { MY_BOOKINGS_PATH } from "@/lib/my-bookings-links"
import { checkPaymentReference } from "@/lib/payment-rules"

export type ReportPaymentResult =
  { ok: true } | { ok: false; error: "signedOut" | "notFound" | "invalid" }

// "I've paid" on the customer's own booking: asks the business to check.
// It never marks the booking paid; only the business does that
// (features/dashboard/api/payment-actions.ts). Works once, on a booking the
// customer chose to pay now and nobody has answered yet.
export async function reportPayment(
  bookingId: unknown,
  reference: unknown
): Promise<ReportPaymentResult> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, error: "signedOut" }
  if (typeof bookingId !== "string" || !bookingId)
    return { ok: false, error: "notFound" }
  const checked = checkPaymentReference(reference)
  if (checked === undefined) return { ok: false, error: "invalid" }
  const reported = await db
    .update(bookings)
    .set({
      paymentStatus: "reported",
      paymentReference: checked,
      paymentReportedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(bookings.id, bookingId),
        ownBookings(customer),
        eq(bookings.paymentChoice, "now"),
        eq(bookings.paymentStatus, "unpaid")
      )
    )
    .returning({
      id: bookings.id,
      businessId: bookings.businessId,
      customerName: bookings.customerName,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
    })
  const [booking] = reported
  if (!booking) return { ok: false, error: "notFound" }
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
