import "server-only"
import { and, asc, eq, gte, lte, ne } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import {
  bookings,
  businessHours,
  businesses,
  services,
  teamMemberHours,
  teamMemberServices,
  teamMembers,
} from "@/lib/db/schema"
import type { Availability } from "../types"
import { availability } from "../utils/availability"
import { isBookable } from "../utils/is-bookable"
import { allowedServiceMemberIds } from "../utils/service-members"
import { checkAddons } from "../utils/addons"
import { loadGroupsForService } from "./addon-groups"

// null = business or service not found, not bookable, invalid add-ons, or
// teamMemberId given but not on the team / not allowed for the service.
export async function getAvailability(
  slug: string,
  serviceId: string,
  teamMemberId: string | null,
  addonIds: string[] = []
): Promise<Availability | null> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) {
    return null
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
    return null
  }

  const service = serviceRows.find((row) => row.id === serviceId)
  if (!service) {
    return null
  }
  const addonCheck = checkAddons(
    await loadGroupsForService(business.id, service.id),
    addonIds
  )
  if (!addonCheck.ok) {
    return null
  }
  const durationMinutes = service.durationMinutes + addonCheck.extraMinutes
  const allowedIds = allowedServiceMemberIds(
    teamRows.map((row) => row.id),
    linkRows,
    service.id
  )
  if (teamMemberId !== null && !allowedIds.includes(teamMemberId)) {
    return null
  }

  const days = await freeDays({
    businessId: business.id,
    timeZone: business.timezone,
    seats: business.seats,
    hours: hourRows,
    memberHours: memberHourRows,
    durationMinutes,
    teamMemberIds: teamMemberId !== null ? [teamMemberId] : allowedIds,
  })
  return { days }
}

// The free times for moving a booking the owner made or took: the same
// person and length, with the booking's own time not counted as taken.
// null = not found, not this owner's, or no longer confirmed.
export async function getMoveAvailability(
  businessId: string,
  ownerId: string,
  bookingId: string
): Promise<Availability | null> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== ownerId) {
    return null
  }
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, businessId)))
    .limit(1)
  if (!booking || booking.status !== "confirmed") {
    return null
  }
  const [hourRows, teamRows, linkRows, memberHourRows] = await Promise.all([
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
  const teamIds = teamRows.map((row) => row.id)
  const days = await freeDays({
    businessId: business.id,
    timeZone: business.timezone,
    seats: business.seats,
    hours: hourRows,
    memberHours: memberHourRows,
    durationMinutes:
      (Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 60_000,
    teamMemberIds:
      booking.teamMemberId !== null
        ? [booking.teamMemberId]
        : booking.serviceId !== null
          ? allowedServiceMemberIds(teamIds, linkRows, booking.serviceId)
          : teamIds,
    ignoreBookingId: booking.id,
  })
  return { days }
}

// The free days ahead for a length of time with any of these team members,
// leaving out the confirmed bookings already made (but `ignoreBookingId`).
async function freeDays(input: {
  businessId: string
  timeZone: string
  seats: number
  hours: (typeof businessHours.$inferSelect)[]
  memberHours: (typeof teamMemberHours.$inferSelect)[]
  durationMinutes: number
  teamMemberIds: string[]
  ignoreBookingId?: string
}) {
  const now = Date.now()
  const from = new Date(now - 86_400_000).toISOString()
  const to = new Date(
    now + (BOOKING_RULES.daysAhead + 1) * 86_400_000
  ).toISOString()
  const taken = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.businessId, input.businessId),
        eq(bookings.status, "confirmed"),
        gte(bookings.startAt, from),
        lte(bookings.startAt, to),
        input.ignoreBookingId
          ? ne(bookings.id, input.ignoreBookingId)
          : undefined
      )
    )

  return availability({
    hours: input.hours,
    memberHours: input.memberHours,
    timeZone: input.timeZone,
    durationMinutes: input.durationMinutes,
    seats: input.seats,
    teamMemberIds: input.teamMemberIds,
    taken,
    now,
  })
}
