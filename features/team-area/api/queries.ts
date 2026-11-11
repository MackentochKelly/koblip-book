import "server-only"

import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  businessHours,
  teamMemberHours,
  teamMembers,
} from "@/lib/db/schema"
import type { TeamSeat } from "@/lib/dal"
import type { HoursRow } from "@/lib/hours-rules"
import { paymentBadgeState, paymentOf } from "@/lib/payment-rules"
import type { StartingCounts, TeamProfile } from "@/lib/team-rules"
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
  // Whether the business lets its team see payment pictures
  // (docs/plans/payment-proof.md, PP9): asked each time, so the owner's
  // switch works at once.
  const [business] = await db
    .select({ teamSeesProof: businesses.paymentProofTeam })
    .from(businesses)
    .where(eq(businesses.id, seat.business.id))
    .limit(1)
  const rows = await db
    .select({
      id: bookings.id,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      customerName: bookings.customerName,
      status: bookings.status,
      paymentChoice: bookings.paymentChoice,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
      paymentReference: bookings.paymentReference,
      paymentProof: bookings.paymentProof,
      paidOnlineMinor: bookings.paidOnlineMinor,
      refundedMinor: bookings.refundedMinor,
      currency: bookings.currency,
      rewardId: bookings.rewardId,
    })
    .from(bookings)
    .where(
      when === "upcoming"
        ? and(mine, gte(bookings.endAt, now), ne(bookings.status, "cancelled"))
        : and(mine, lt(bookings.endAt, now))
    )
    .orderBy(when === "upcoming" ? asc(bookings.startAt) : desc(bookings.startAt))
    .limit(LIST_LIMIT)
  return rows.map(
    ({ paymentChoice, paymentMethod, paymentStatus, paymentReference, paymentProof, paidOnlineMinor, refundedMinor, currency, rewardId, ...booking }) => {
      // A cancelled booking has nothing to pay. Only the way's name, the
      // status and whether there is a picture to open leave here.
      const payment =
        booking.status === "cancelled"
          ? null
          : paymentOf({ paymentChoice, paymentMethod, paymentStatus, paymentReference, paymentProof, paidOnlineMinor, refundedMinor })
      const kept = payment?.online
        ? payment.online.paidMinor - payment.online.refundedMinor
        : 0
      return {
        ...booking,
        reward: rewardId !== null,
        payment: payment && {
          way: payment.method?.name ?? null,
          status: paymentBadgeState(payment),
          proof: payment.hasProof && Boolean(business?.teamSeesProof),
          // The amount only: never how the customer paid it.
          paidOnlineMinor: kept > 0 ? kept : null,
          currency,
        },
      }
    }
  )
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
export async function getMyProfile(
  seat: TeamSeat
): Promise<TeamProfile & StartingCounts> {
  const [row] = await db
    .select({
      description: teamMembers.description,
      about: teamMembers.about,
      languages: teamMembers.languages,
      pastAppointments: teamMembers.pastAppointments,
      pastClients: teamMembers.pastClients,
    })
    .from(teamMembers)
    .where(eq(teamMembers.id, seat.teamMemberId))
    .limit(1)
  return {
    description: row?.description ?? null,
    about: row?.about ?? null,
    languages: row?.languages ?? [],
    pastAppointments: row?.pastAppointments ?? 0,
    pastClients: row?.pastClients ?? 0,
  }
}
