import "server-only"

import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  bookings,
  businessHours,
  teamMemberHours,
  teamMembers,
} from "@/lib/db/schema"
import type { TeamSeat } from "@/lib/dal"
import type { HoursRow } from "@/lib/hours-rules"
import type { TeamProfile } from "@/lib/team-rules"
import type { MyBooking } from "../types"

// How many bookings one list shows.
const LIST_LIMIT = 100

// The team member's own bookings, never anyone else's: upcoming (not
// ended, not cancelled) soonest first, or past, latest first.
export async function getMyBookings(
  seat: TeamSeat,
  when: "upcoming" | "past"
): Promise<MyBooking[]> {
  const now = new Date().toISOString()
  const mine = and(
    eq(bookings.businessId, seat.business.id),
    eq(bookings.teamMemberId, seat.teamMemberId)
  )
  return db
    .select({
      id: bookings.id,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      customerName: bookings.customerName,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      when === "upcoming"
        ? and(mine, gte(bookings.endAt, now), ne(bookings.status, "cancelled"))
        : and(mine, lt(bookings.endAt, now))
    )
    .orderBy(when === "upcoming" ? asc(bookings.startAt) : desc(bookings.startAt))
    .limit(LIST_LIMIT)
}

// Their working week: their own hours, or the business's when they have
// none (the owner's "Same as business hours").
export async function getMyHours(seat: TeamSeat): Promise<HoursRow[]> {
  const own = await db
    .select({
      weekday: teamMemberHours.weekday,
      opensAt: teamMemberHours.opensAt,
      closesAt: teamMemberHours.closesAt,
    })
    .from(teamMemberHours)
    .where(eq(teamMemberHours.teamMemberId, seat.teamMemberId))
    .orderBy(asc(teamMemberHours.weekday), asc(teamMemberHours.opensAt))
  if (own.length) return own
  return db
    .select({
      weekday: businessHours.weekday,
      opensAt: businessHours.opensAt,
      closesAt: businessHours.closesAt,
    })
    .from(businessHours)
    .where(eq(businessHours.businessId, seat.business.id))
    .orderBy(asc(businessHours.weekday), asc(businessHours.opensAt))
}

// What customers see on their public profile.
export async function getMyProfile(seat: TeamSeat): Promise<TeamProfile> {
  const [row] = await db
    .select({
      description: teamMembers.description,
      about: teamMembers.about,
      languages: teamMembers.languages,
    })
    .from(teamMembers)
    .where(eq(teamMembers.id, seat.teamMemberId))
    .limit(1)
  return {
    description: row?.description ?? null,
    about: row?.about ?? null,
    languages: row?.languages ?? [],
  }
}
