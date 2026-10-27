import "server-only"
import { and, asc, desc, eq, gte, lt } from "drizzle-orm"
import { notFound } from "next/navigation"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  bookings,
  businessHours,
  businesses,
  services,
  teamMembers,
} from "@/lib/db/schema"
import type { OwnedBusiness, OwnerBooking } from "../types"
import { getBookingAddons, toOwnerBooking } from "./customers"

function zonedDateTime(
  iso: string,
  timeZone: string
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .formatToParts(Date.parse(iso))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

function zoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(utcMs)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return asUtc - utcMs
}

// UTC ms of midnight starting that date in the zone.
function zonedDayStart(date: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map(Number)
  const target = Date.UTC(year, month - 1, day)
  let utc = target
  for (let i = 0; i < 3; i += 1) {
    utc = target - zoneOffsetMs(timeZone, utc)
  }
  return utc
}

async function ownedBusiness(businessId: string) {
  const session = await requireOwner()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId) {
    notFound()
  }
  return business
}

export async function getMyBusinesses(): Promise<OwnedBusiness[]> {
  const session = await requireOwner()
  const rows = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      address: businesses.address,
    })
    .from(businesses)
    .where(eq(businesses.ownerId, session.userId))
    .orderBy(asc(businesses.name))
  return rows
}

export async function getOwnerBusiness(businessId: string) {
  const business = await ownedBusiness(businessId)
  const [hours, serviceRows, team] = await Promise.all([
    db
      .select()
      .from(businessHours)
      .where(eq(businessHours.businessId, business.id))
      .orderBy(asc(businessHours.weekday), asc(businessHours.opensAt)),
    db
      .select()
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(asc(services.position)),
    db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id))
      .orderBy(asc(teamMembers.position)),
  ])
  return { business, hours, services: serviceRows, team }
}

export async function getBookings(
  businessId: string,
  range: "upcoming" | "past"
): Promise<OwnerBooking[]> {
  const business = await ownedBusiness(businessId)
  const now = new Date().toISOString()
  const rows =
    range === "upcoming"
      ? await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.businessId, business.id),
              gte(bookings.endAt, now)
            )
          )
          .orderBy(asc(bookings.startAt))
          .limit(200)
      : await db
          .select()
          .from(bookings)
          .where(
            and(eq(bookings.businessId, business.id), lt(bookings.endAt, now))
          )
          .orderBy(desc(bookings.startAt))
          .limit(100)
  const addonsByBooking = await getBookingAddons(rows.map((row) => row.id))
  return rows.map((row) =>
    toOwnerBooking(row, business.timezone, addonsByBooking.get(row.id) ?? [])
  )
}

export async function getBookingCounts(
  businessId: string
): Promise<{ today: number; upcoming: number }> {
  const business = await ownedBusiness(businessId)
  const now = new Date().toISOString()
  const todayDate = zonedDateTime(now, business.timezone).date
  const [year, month, day] = todayDate.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  const tomorrowDate = new Date(
    Date.UTC(year, month - 1, day) + 86_400_000
  )
  const tomorrow = `${tomorrowDate.getUTCFullYear()}-${pad(tomorrowDate.getUTCMonth() + 1)}-${pad(tomorrowDate.getUTCDate())}`
  const todayStart = new Date(
    zonedDayStart(todayDate, business.timezone)
  ).toISOString()
  const tomorrowStart = new Date(
    zonedDayStart(tomorrow, business.timezone)
  ).toISOString()
  const [todayRows, upcomingRows] = await Promise.all([
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, business.id),
          eq(bookings.status, "confirmed"),
          gte(bookings.startAt, todayStart),
          lt(bookings.startAt, tomorrowStart)
        )
      ),
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, business.id),
          eq(bookings.status, "confirmed"),
          gte(bookings.endAt, now)
        )
      ),
  ])
  return { today: todayRows.length, upcoming: upcomingRows.length }
}
