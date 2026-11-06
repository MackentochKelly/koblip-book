"use server"

import { revalidatePath } from "next/cache"

import { MY_BOOKINGS_PATH } from "@/lib/customer-auth-path"
import { getCustomer } from "@/lib/customer-dal"
import { saveAll } from "@/lib/db/save-all"
import { requestGoogleSync } from "@/lib/google-calendar-sync"
import { notification } from "@/lib/in-app-notifications"
import { revalidateBusiness } from "@/lib/revalidate-business"
import {
  DATE_PATTERN,
  TIME_PATTERN,
  isRealDate,
  toMinutes,
} from "../utils/owner-time"
import { zonedInstant } from "../utils/zoned-time"
import { inBookingTurn } from "./booking-turn"
import { customerBookingToMove, moveAvailability } from "./get-availability"
import { moveWrites } from "./move-writes"

export type CustomerMoveResult =
  | { status: "moved" }
  | { status: "taken" }
  | { status: "signedOut" | "notFound" | "invalid" | "failed" }

// The signed-in customer moves their own booking still ahead to another
// free time, with the same person and length, under the online booking
// rules (notice, days ahead). It moves like an owner's move (moveWrites):
// the customer gets "Booking changed" and new reminders, and the owner's
// bell hears of it.
export async function moveCustomerBooking(input: {
  bookingId: unknown
  date: unknown
  time: unknown
}): Promise<CustomerMoveResult> {
  try {
    const customer = await getCustomer()
    if (!customer) return { status: "signedOut" }
    const { bookingId, date, time } = input
    if (
      typeof bookingId !== "string" ||
      typeof date !== "string" ||
      typeof time !== "string" ||
      !DATE_PATTERN.test(date) ||
      !isRealDate(date) ||
      !TIME_PATTERN.test(time)
    ) {
      return { status: "invalid" }
    }
    const found = await customerBookingToMove(bookingId, customer.phone)
    if (!found) return { status: "notFound" }
    const { business } = found

    const outcome = await inBookingTurn(business.id, async () => {
      // Read again inside the turn: nothing else moves it meanwhile.
      const current = await customerBookingToMove(bookingId, customer.phone)
      if (!current) return { status: "notFound" } as const
      const { booking } = current
      const free = await moveAvailability(business, booking)
      const day = free.days.find((entry) => entry.date === date)
      if (!day?.times.includes(time)) return { status: "taken" } as const
      const startInstant = zonedInstant(
        date,
        toMinutes(time),
        business.timezone
      )
      if (startInstant === Date.parse(booking.startAt)) {
        return { status: "moved" } as const
      }
      await saveAll([
        ...moveWrites(booking, startInstant),
        ...(await notification(
          business.id,
          "customerMoved",
          {
            customerName: booking.customerName,
            serviceName: booking.serviceName,
            startAt: new Date(startInstant).toISOString(),
          },
          { dedupeKey: `customerMoved:${booking.id}:${booking.moves + 1}` }
        )),
      ])
      return { status: "moved" } as const
    })

    if (outcome.status === "moved") {
      revalidateBusiness(business.slug)
      revalidatePath(MY_BOOKINGS_PATH)
      // Google Calendar hears of it now, without the booking waiting.
      requestGoogleSync(business.id)
    }
    return outcome
  } catch {
    console.error("moveCustomerBooking failed")
    return { status: "failed" }
  }
}
