"use server"

import { and, eq, gte, inArray, lte, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  bookings,
  businessHours,
  businesses,
  notificationSends,
} from "@/lib/db/schema"
import type { OwnerMoveInput, OwnerMoveResult } from "@/types/owner-booking"
import { availability, dayOpenStretches } from "../utils/availability"
import {
  DATE_PATTERN,
  TIME_PATTERN,
  isRealDate,
  toMinutes,
} from "../utils/owner-time"
import { addDays, zonedInstant, zonedToday } from "../utils/zoned-time"
import { inBookingTurn } from "./booking-turn"

// The owner moves a booking that has not started to a later day or time,
// with the same person and length. Same opening-hours and busy checks as
// adding one; the owner can move over a conflict with allowConflict. Its
// waiting reminders and "Booking changed" message stop, and the sender
// sends "Booking changed" and new reminders for the new time (D5 in
// docs/plans/whatsapp-notifications.md).
export async function moveOwnerBooking(
  input: OwnerMoveInput
): Promise<OwnerMoveResult> {
  try {
    if (!DATE_PATTERN.test(input.date) || !isRealDate(input.date)) {
      return { status: "invalid", field: "date" }
    }
    if (!TIME_PATTERN.test(input.time)) {
      return { status: "invalid", field: "time" }
    }

    // Same owner check as createOwnerBooking: features/booking may not
    // import the dashboard's ownedBusiness.
    const session = await requireOwner()
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, input.businessId))
      .limit(1)
    if (!business || business.ownerId !== session.userId) {
      return { status: "failed" }
    }

    const today = zonedToday(Date.now(), business.timezone)
    if (
      input.date < today ||
      input.date > addDays(today, BOOKING_RULES.ownerDaysAhead)
    ) {
      return { status: "invalid", field: "date" }
    }
    const startInstant = zonedInstant(
      input.date,
      toMinutes(input.time),
      business.timezone
    )
    if (startInstant <= Date.now()) {
      return { status: "invalid", field: "time" }
    }

    const outcome = await inBookingTurn(business.id, async () => {
      const [booking] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.businessId, business.id)
          )
        )
        .limit(1)
      if (
        !booking ||
        booking.status !== "confirmed" ||
        Date.parse(booking.startAt) <= Date.now()
      ) {
        return { status: "failed" } as const
      }
      if (Date.parse(booking.startAt) === startInstant) {
        return { status: "moved" } as const
      }
      const endInstant = startInstant + booking.durationMinutes * 60_000

      if (!input.allowConflict) {
        const startMinute = toMinutes(input.time)
        const endMinute = startMinute + booking.durationMinutes
        const hourRows = await db
          .select()
          .from(businessHours)
          .where(eq(businessHours.businessId, business.id))
        const open = dayOpenStretches(hourRows, input.date).some(
          (stretch) => stretch.start <= startMinute && endMinute <= stretch.end
        )
        if (!open) {
          return { status: "conflict", reason: "closed" } as const
        }
        const dayStart = zonedInstant(input.date, 0, business.timezone)
        const dayEnd = zonedInstant(addDays(input.date, 1), 0, business.timezone)
        const taken = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.businessId, business.id),
              eq(bookings.status, "confirmed"),
              ne(bookings.id, booking.id),
              gte(bookings.startAt, new Date(dayStart - 86_400_000).toISOString()),
              lte(bookings.startAt, new Date(dayEnd + 86_400_000).toISOString())
            )
          )
        const [day] = availability({
          hours: hourRows,
          timeZone: business.timezone,
          durationMinutes: booking.durationMinutes,
          seats: business.seats,
          teamMemberIds: booking.teamMemberId ? [booking.teamMemberId] : [],
          taken,
          now: Date.now(),
          dates: [input.date],
          ignoreCutoff: true,
        })
        if (!day.times.includes(input.time)) {
          return { status: "conflict", reason: "busy" } as const
        }
      }

      await saveAll([
        db
          .update(bookings)
          .set({
            startAt: new Date(startInstant).toISOString(),
            endAt: new Date(endInstant).toISOString(),
            moves: booking.moves + 1,
          })
          .where(eq(bookings.id, booking.id)),
        db
          .update(notificationSends)
          .set({ state: "skipped", reason: "moved" })
          .where(
            and(
              eq(notificationSends.bookingId, booking.id),
              eq(notificationSends.state, "pending"),
              inArray(notificationSends.message, ["reminder", "changed"])
            )
          ),
        // A confirmation still waiting goes with the new time, so it counts
        // as telling the customer of this move.
        db
          .update(notificationSends)
          .set({ moves: booking.moves + 1 })
          .where(
            and(
              eq(notificationSends.bookingId, booking.id),
              eq(notificationSends.state, "pending"),
              eq(notificationSends.message, "confirmed")
            )
          ),
      ])
      return { status: "moved" } as const
    })

    if (outcome.status === "moved") {
      revalidatePath("/b/" + business.slug)
      revalidatePath("/dashboard", "layout")
    }
    return outcome
  } catch {
    console.error("moveOwnerBooking failed")
    return { status: "failed" }
  }
}
