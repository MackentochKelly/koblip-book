import "server-only"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import {
  bookings,
  businessHours,
  businesses,
  services,
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
        eq(bookings.businessId, business.id),
        eq(bookings.status, "confirmed"),
        gte(bookings.startAt, from),
        lte(bookings.startAt, to)
      )
    )

  const days = availability({
    hours: hourRows,
    timeZone: business.timezone,
    durationMinutes,
    seats: business.seats,
    teamMemberIds:
      teamMemberId !== null ? [teamMemberId] : allowedIds,
    taken,
    now,
  })
  return { days }
}
