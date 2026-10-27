"use server"

import { and, asc, eq, gte, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  bookingAddons,
  bookings,
  businessHours,
  businesses,
  services,
  teamMemberServices,
  teamMembers,
} from "@/lib/db/schema"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
} from "@/types/owner-booking"
import { availability, dayOpenStretches } from "../utils/availability"
import { checkAddons } from "../utils/addons"
import { loadGroupsForService } from "./addon-groups"
import {
  allowedServiceMemberIds,
  firstFreeMember,
} from "../utils/service-members"
import { addDays, zonedInstant, zonedToday } from "../utils/zoned-time"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

function isRealDate(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number)
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false
  }
  const utc = new Date(Date.UTC(year, month - 1, day))
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  )
}

// Walk-in / phone bookings by the owner. Same opening-hours and busy logic
// as online booking, but no minimum notice, past dates allowed, and the
// owner can book over a conflict with allowConflict.
export async function createOwnerBooking(
  input: OwnerBookingInput
): Promise<OwnerBookingResult> {
  try {
    const name = input.name.trim()
    if (name.length < 1 || name.length > BOOKING_RULES.maxCustomerName) {
      return { status: "invalid", field: "name" }
    }
    const rawPhone = input.phone === null ? "" : input.phone.trim()
    const phone = rawPhone === "" ? null : rawPhone
    if (phone !== null && !PHONE_PATTERN.test(phone)) {
      return { status: "invalid", field: "phone" }
    }
    const rawNote = input.note === null ? "" : input.note.trim()
    const note = rawNote === "" ? null : rawNote
    if (note !== null && note.length > BOOKING_RULES.maxNote) {
      return { status: "invalid", field: "note" }
    }
    if (!DATE_PATTERN.test(input.date) || !isRealDate(input.date)) {
      return { status: "invalid", field: "date" }
    }
    if (!TIME_PATTERN.test(input.time)) {
      return { status: "invalid", field: "time" }
    }

    // Same 10-line owner check as the dashboard's ownedBusiness, written
    // here because features/booking may not import features/dashboard.
    const session = await requireOwner()
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, input.businessId))
      .limit(1)
    if (!business || business.ownerId !== session.userId) {
      return { status: "failed" }
    }

    const [serviceRows, hourRows, teamRows, linkRows] = await Promise.all([
      db
        .select()
        .from(services)
        .where(eq(services.businessId, business.id)),
      db
        .select()
        .from(businessHours)
        .where(eq(businessHours.businessId, business.id)),
      db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.businessId, business.id))
        .orderBy(asc(teamMembers.position)),
      db
        .select()
        .from(teamMemberServices)
        .where(eq(teamMemberServices.businessId, business.id)),
    ])

    const service = serviceRows.find((row) => row.id === input.serviceId)
    if (!service) {
      return { status: "invalid", field: "service" }
    }
    const addonCheck = checkAddons(
      await loadGroupsForService(business.id, service.id),
      input.addonIds
    )
    if (!addonCheck.ok) {
      return { status: "invalid", field: "addons" }
    }
    const totalMinutes = service.durationMinutes + addonCheck.extraMinutes
    const totalPrice =
      service.priceMinor === null
        ? addonCheck.extraPriceMinor
        : service.priceMinor + (addonCheck.extraPriceMinor ?? 0)
    const allowedIds = allowedServiceMemberIds(
      teamRows.map((row) => row.id),
      linkRows,
      service.id
    )
    const allowedRows = teamRows.filter((row) => allowedIds.includes(row.id))
    const member =
      input.teamMemberId === null
        ? null
        : (teamRows.find((row) => row.id === input.teamMemberId) ?? null)
    if (
      input.teamMemberId !== null &&
      (!member || !allowedIds.includes(member.id))
    ) {
      return { status: "invalid", field: "teamMember" }
    }

    const today = zonedToday(Date.now(), business.timezone)
    const minDate = addDays(today, -BOOKING_RULES.ownerDaysBack)
    const maxDate = addDays(today, BOOKING_RULES.ownerDaysAhead)
    if (input.date < minDate || input.date > maxDate) {
      return { status: "invalid", field: "date" }
    }

    const startInstant = zonedInstant(
      input.date,
      toMinutes(input.time),
      business.timezone
    )
    const endInstant = startInstant + totalMinutes * 60_000

    const outcome = await db.transaction(async (tx) => {
      const dayStart = zonedInstant(input.date, 0, business.timezone)
      const dayEnd = zonedInstant(
        addDays(input.date, 1),
        0,
        business.timezone
      )
      const taken = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.businessId, business.id),
            eq(bookings.status, "confirmed"),
            gte(bookings.startAt, new Date(dayStart - 86_400_000).toISOString()),
            lte(bookings.startAt, new Date(dayEnd + 86_400_000).toISOString())
          )
        )

      if (!input.allowConflict) {
        const startMinute = toMinutes(input.time)
        const endMinute = startMinute + totalMinutes
        const open = dayOpenStretches(hourRows, input.date).some(
          (stretch) =>
            stretch.start <= startMinute && endMinute <= stretch.end
        )
        if (!open) {
          return { status: "conflict", reason: "closed" } as const
        }
        const [day] = availability({
          hours: hourRows,
          timeZone: business.timezone,
          durationMinutes: totalMinutes,
          seats: business.seats,
          teamMemberIds:
            input.teamMemberId !== null ? [input.teamMemberId] : allowedIds,
          taken,
          now: Date.now(),
          dates: [input.date],
          ignoreCutoff: true,
        })
        if (!day.times.includes(input.time)) {
          return { status: "conflict", reason: "busy" } as const
        }
      }

      let teamMemberId: string | null = input.teamMemberId
      let teamMemberName: string | null = member?.name ?? null
      if (teamMemberId === null && allowedRows.length > 0) {
        const free = firstFreeMember(
          allowedRows,
          taken,
          startInstant,
          endInstant
        )
        if (free) {
          teamMemberId = free.id
          teamMemberName = free.name
        } else if (!input.allowConflict) {
          return { status: "conflict", reason: "busy" } as const
        } else {
          teamMemberId = allowedRows[0].id
          teamMemberName = allowedRows[0].name
        }
      }

      const bookingId = crypto.randomUUID()
      await tx.insert(bookings).values({
        id: bookingId,
        businessId: business.id,
        serviceId: service.id,
        teamMemberId,
        serviceName: service.name,
        teamMemberName,
        durationMinutes: totalMinutes,
        priceMinor: totalPrice,
        currency: business.currency,
        startAt: new Date(startInstant).toISOString(),
        endAt: new Date(endInstant).toISOString(),
        customerName: name,
        customerPhone: phone,
        source: "owner",
        status: "confirmed",
        note,
      })
      if (addonCheck.options.length > 0) {
        await tx.insert(bookingAddons).values(
          addonCheck.options.map((option, index) => ({
            businessId: business.id,
            bookingId,
            optionId: option.id,
            name: option.name,
            priceMinor: option.priceMinor,
            durationMinutes: option.durationMinutes,
            position: index,
          }))
        )
      }
      return { status: "booked", bookingId } as const
    })

    if (outcome.status === "conflict") {
      return outcome
    }
    revalidatePath("/b/" + business.slug)
    revalidatePath("/dashboard", "layout")
    return outcome
  } catch {
    console.error("createOwnerBooking failed")
    return { status: "failed" }
  }
}
