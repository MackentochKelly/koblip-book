import "server-only"

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { notFound } from "next/navigation"
import { customerKey } from "@/lib/customer-key"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookingAddons, bookings, businesses, customers } from "@/lib/db/schema"
import type { OwnerBooking, OwnerCustomer } from "../types"

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

export function toOwnerBooking(
  row: typeof bookings.$inferSelect,
  timeZone: string,
  addons: OwnerBooking["addons"] = []
): OwnerBooking {
  const start = zonedDateTime(row.startAt, timeZone)
  const end = zonedDateTime(row.endAt, timeZone)
  return {
    id: row.id,
    date: start.date,
    time: start.time,
    endTime: end.time,
    startAt: row.startAt,
    endAt: row.endAt,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    teamMemberId: row.teamMemberId,
    teamMemberName: row.teamMemberName,
    durationMinutes: row.durationMinutes,
    priceMinor: row.priceMinor,
    currency: row.currency,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerKey: customerKey(row.customerPhone, row.customerName),
    status: row.status as OwnerBooking["status"],
    source: row.source as OwnerBooking["source"],
    note: row.note,
    addons,
  }
}

// The stored add-on copies for a set of bookings, in display order,
// with one query for all of them.
export async function getBookingAddons(
  bookingIds: string[]
): Promise<Map<string, OwnerBooking["addons"]>> {
  const byBooking = new Map<string, OwnerBooking["addons"]>()
  if (bookingIds.length === 0) {
    return byBooking
  }
  const rows = await db
    .select()
    .from(bookingAddons)
    .where(inArray(bookingAddons.bookingId, bookingIds))
    .orderBy(asc(bookingAddons.position))
  for (const row of rows) {
    const list = byBooking.get(row.bookingId)
    const entry = {
      name: row.name,
      priceMinor: row.priceMinor,
      durationMinutes: row.durationMinutes,
    }
    if (list) {
      list.push(entry)
    } else {
      byBooking.set(row.bookingId, [entry])
    }
  }
  return byBooking
}

async function ownedBusinessOrNotFound(businessId: string) {
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

const MAX_CUSTOMERS = 500
const MAX_CUSTOMER_BOOKINGS = 100

// Up to 500 customers, counted by the database (one row per customer, not
// per booking): those with a next booking first (soonest), then by latest
// activity. Name and phone come from each customer's latest booking.
// Customers the owner added who have not booked yet come first, newest
// first, so one just added is in sight.
export async function getCustomers(
  businessId: string
): Promise<OwnerCustomer[]> {
  const business = await ownedBusinessOrNotFound(businessId)
  const now = new Date(Date.now()).toISOString()
  const startAt = bookings.startAt
  const status = bookings.status
  const nextStart = sql<
    string | null
  >`min(case when ${status} = 'confirmed' and ${startAt} > ${now} then ${startAt} end)`
  const lastActivity = sql<string>`max(${startAt})`
  const groups = await db
    .select({
      key: sql<string>`${bookings.customerKey}`,
      bookings: sql<number>`count(*)`,
      completed: sql<number>`sum(${status} = 'completed')`,
      noShows: sql<number>`sum(${status} = 'no_show')`,
      cancelled: sql<number>`sum(${status} = 'cancelled')`,
      lastCompleted: sql<
        string | null
      >`max(case when ${status} = 'completed' then ${startAt} end)`,
      firstStart: sql<string>`min(${startAt})`,
      nextStart,
      spentMinor: sql<number>`coalesce(sum(case when ${status} = 'completed' then ${bookings.priceMinor} end), 0)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.businessId, business.id), isNotNull(bookings.customerKey))
    )
    .groupBy(bookings.customerKey)
    .orderBy(
      sql`${nextStart} is null`,
      nextStart,
      desc(lastActivity),
      bookings.customerKey
    )
    .limit(MAX_CUSTOMERS)
  const saved = await db
    .select()
    .from(customers)
    .where(eq(customers.businessId, business.id))
    .orderBy(desc(customers.createdAt))
  const booked = new Set(groups.map((group) => group.key))
  const added: OwnerCustomer[] = saved
    .filter((customer) => !booked.has(customer.customerKey))
    .map((customer) => ({
      key: customer.customerKey,
      name: customer.name,
      phone: customer.phone,
      bookings: 0,
      completed: 0,
      noShows: 0,
      cancelled: 0,
      lastVisit: null,
      firstBooking: null,
      nextBooking: null,
      spentMinor: 0,
      currency: business.currency,
    }))
  if (groups.length === 0) {
    return added.slice(0, MAX_CUSTOMERS)
  }

  const ranked = db
    .select({
      key: bookings.customerKey,
      name: bookings.customerName,
      phone: bookings.customerPhone,
      rank: sql<number>`row_number() over (partition by ${bookings.customerKey} order by ${startAt} desc)`.as(
        "rank"
      ),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.businessId, business.id),
        inArray(
          bookings.customerKey,
          groups.map((group) => group.key)
        )
      )
    )
    .as("ranked")
  const latestRows = await db
    .select({ key: ranked.key, name: ranked.name, phone: ranked.phone })
    .from(ranked)
    .where(eq(ranked.rank, 1))
  const latest = new Map(latestRows.map((row) => [row.key, row]))

  const day = (iso: string | null) =>
    iso === null ? null : zonedDateTime(iso, business.timezone).date
  const fromBookings: OwnerCustomer[] = groups.map((group) => ({
    key: group.key,
    name: latest.get(group.key)?.name ?? "",
    phone: latest.get(group.key)?.phone ?? null,
    bookings: group.bookings,
    completed: group.completed,
    noShows: group.noShows,
    cancelled: group.cancelled,
    lastVisit: day(group.lastCompleted),
    firstBooking: day(group.firstStart),
    nextBooking: day(group.nextStart),
    spentMinor: group.spentMinor,
    currency: business.currency,
  }))
  return [...added, ...fromBookings].slice(0, MAX_CUSTOMERS)
}

// One customer's latest 100 bookings, newest first.
export async function getCustomerBookings(
  businessId: string,
  key: string
): Promise<OwnerBooking[]> {
  const business = await ownedBusinessOrNotFound(businessId)
  const listed = await db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.businessId, business.id), eq(bookings.customerKey, key))
    )
    .orderBy(desc(bookings.startAt))
    .limit(MAX_CUSTOMER_BOOKINGS)
  const addonsByBooking = await getBookingAddons(listed.map((row) => row.id))
  return listed.map((row) =>
    toOwnerBooking(row, business.timezone, addonsByBooking.get(row.id) ?? [])
  )
}
