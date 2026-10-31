"use server"

import { and, asc, eq, gte, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { customerKey } from "@/lib/customer-key"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  bookingAddons,
  bookings,
  businessHours,
  businesses,
  services,
  teamMemberHours,
  teamMemberServices,
  teamMembers,
} from "@/lib/db/schema"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
} from "@/types/owner-booking"
import {
  workingMemberIds,
  availability,
  dayOpenStretches,
  memberOpenStretches,
} from "../utils/availability"
import { checkAddons } from "../utils/addons"
import { loadGroupsForService } from "./addon-groups"
import { inBookingTurn } from "./booking-turn"
import {
  allowedServiceMemberIds,
  firstFreeMember,
} from "../utils/service-members"
import {
  DATE_PATTERN,
  TIME_PATTERN,
  isRealDate,
  toMinutes,
} from "../utils/owner-time"
import { addDays, zonedInstant, zonedToday } from "../utils/zoned-time"

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

    const [serviceRows, hourRows, teamRows, linkRows, memberHourRows] =
      await Promise.all([
        db.select().from(services).where(eq(services.businessId, business.id)),
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
        db
          .select()
          .from(teamMemberHours)
          .where(eq(teamMemberHours.businessId, business.id)),
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

    const outcome = await inBookingTurn(business.id, async () => {
      const dayStart = zonedInstant(input.date, 0, business.timezone)
      const dayEnd = zonedInstant(addDays(input.date, 1), 0, business.timezone)
      const taken = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.businessId, business.id),
            eq(bookings.status, "confirmed"),
            gte(
              bookings.startAt,
              new Date(dayStart - 86_400_000).toISOString()
            ),
            lte(bookings.startAt, new Date(dayEnd + 86_400_000).toISOString())
          )
        )

      if (!input.allowConflict) {
        const startMinute = toMinutes(input.time)
        const endMinute = startMinute + totalMinutes
        const open = (
          member
            ? memberOpenStretches(
                hourRows,
                memberHourRows,
                member.id,
                input.date
              )
            : dayOpenStretches(hourRows, input.date)
        ).some(
          (stretch) => stretch.start <= startMinute && endMinute <= stretch.end
        )
        if (!open) {
          return { status: "conflict", reason: "closed" } as const
        }
        const [day] = availability({
          hours: hourRows,
          memberHours: memberHourRows,
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

      const workingIds = workingMemberIds(
        hourRows,
        memberHourRows,
        allowedIds,
        input.date,
        toMinutes(input.time),
        totalMinutes
      )
      const workingRows = allowedRows.filter((row) =>
        workingIds.includes(row.id)
      )
      let teamMemberId: string | null = input.teamMemberId
      let teamMemberName: string | null = member?.name ?? null
      if (teamMemberId === null && allowedRows.length > 0) {
        const free = firstFreeMember(
          workingRows,
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
          if (!workingRows.length)
            return { status: "conflict", reason: "closed" } as const
          teamMemberId = workingRows[0].id
          teamMemberName = workingRows[0].name
        }
      }

      const bookingId = crypto.randomUUID()
      await saveAll([
        db.insert(bookings).values({
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
          customerKey: customerKey(phone, name),
          source: "owner",
          status: "confirmed",
          note,
          whatsappOptIn: !!phone && input.whatsappOptIn === true,
          language: input.language === "es" ? "es" : "en",
        }),
        ...(addonCheck.options.length > 0
          ? [
              db.insert(bookingAddons).values(
                addonCheck.options.map((option, index) => ({
                  businessId: business.id,
                  bookingId,
                  optionId: option.id,
                  name: option.name,
                  priceMinor: option.priceMinor,
                  durationMinutes: option.durationMinutes,
                  position: index,
                }))
              ),
            ]
          : []),
      ])
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
