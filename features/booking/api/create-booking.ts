"use server"

import { and, asc, eq, gte, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { customerKey } from "@/lib/customer-key"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { notification } from "@/lib/in-app-notifications"
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
import type { BookingInput, BookingResult } from "../types"
import { workingMemberIds, availability } from "../utils/availability"
import { checkAddons } from "../utils/addons"
import { isBookable } from "../utils/is-bookable"
import { loadGroupsForService } from "./addon-groups"
import { inBookingTurn } from "./booking-turn"
import {
  allowedServiceMemberIds,
  firstFreeMember,
} from "../utils/service-members"
import { addDays, zonedInstant } from "../utils/zoned-time"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

// No sign-in needed for customers. Every unexpected error becomes "failed".
export async function createBooking(
  input: BookingInput
): Promise<BookingResult> {
  try {
    const name = input.name.trim()
    if (name.length < 1 || name.length > BOOKING_RULES.maxCustomerName) {
      return { status: "invalid", field: "name" }
    }
    const phone = input.phone.trim()
    if (!PHONE_PATTERN.test(phone)) {
      return { status: "invalid", field: "phone" }
    }
    if (!DATE_PATTERN.test(input.date) || !TIME_PATTERN.test(input.time)) {
      return { status: "invalid", field: "time" }
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, input.slug))
      .limit(1)
    if (!business) {
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

    if (
      !isBookable({
        status: business.status,
        servicesCount: serviceRows.length,
        hoursCount: hourRows.length,
      })
    ) {
      return { status: "failed" }
    }

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

    const startInstant = zonedInstant(
      input.date,
      toMinutes(input.time),
      business.timezone
    )
    const endInstant = startInstant + totalMinutes * 60_000

    const confirmation = await inBookingTurn(business.id, async () => {
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
      })
      if (!day.times.includes(input.time)) {
        return null
      }

      let teamMemberId: string | null = input.teamMemberId
      let teamMemberName: string | null = member?.name ?? null
      if (teamMemberId === null && allowedRows.length > 0) {
        const free = firstFreeMember(
          allowedRows.filter(
            (row) =>
              workingMemberIds(
                hourRows,
                memberHourRows,
                [row.id],
                input.date,
                toMinutes(input.time),
                totalMinutes
              ).length > 0
          ),
          taken,
          startInstant,
          endInstant
        )
        if (!free) {
          return null
        }
        teamMemberId = free.id
        teamMemberName = free.name
      }

      const bookingId = crypto.randomUUID()
      const startAt = new Date(startInstant).toISOString()
      // The owner's bell hears of it, saved with the booking.
      const notice = await notification(
        business.id,
        "newBooking",
        { customerName: name, serviceName: service.name, startAt },
        { dedupeKey: `booking:${bookingId}` }
      )
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
          startAt,
          endAt: new Date(endInstant).toISOString(),
          customerName: name,
          customerPhone: phone,
          customerKey: customerKey(phone, name),
          whatsappOptIn: input.whatsappOptIn === true,
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
        ...notice,
      ])
      return {
        id: bookingId,
        businessName: business.name,
        address: business.address,
        timeZone: business.timezone,
        serviceName: service.name,
        teamMemberName,
        durationMinutes: totalMinutes,
        priceMinor: totalPrice,
        currency: business.currency,
        date: input.date,
        time: input.time,
        addons: addonCheck.options.map((option) => ({
          name: option.name,
          priceMinor: option.priceMinor,
          durationMinutes: option.durationMinutes,
        })),
      }
    })

    if (!confirmation) {
      return { status: "taken" }
    }
    revalidatePath("/dashboard", "layout")
    return { status: "booked", booking: confirmation }
  } catch {
    console.error("createBooking failed")
    return { status: "failed" }
  }
}
