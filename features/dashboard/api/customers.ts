import "server-only"

import { asc, desc, eq, inArray } from "drizzle-orm"
import { notFound } from "next/navigation"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookingAddons, bookings, businesses } from "@/lib/db/schema"
import type { OwnerBooking, OwnerCustomer } from "../types"

export function customerKey(phone: string | null, name: string): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length > 0) {
    return `p:${digits}`
  }
  return `n:${name.trim().toLowerCase().replace(/\s+/g, " ")}`
}

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

export interface CustomerBookingRow {
  customerName: string
  customerPhone: string | null
  status: string
  startAt: string
  priceMinor: number | null
}

// Pure aggregation so the counting can be tested without the database.
export function buildCustomers(
  rows: CustomerBookingRow[],
  nowMs: number,
  timeZone: string,
  currency: string
): OwnerCustomer[] {
  const groups = new Map<string, CustomerBookingRow[]>()
  for (const row of rows) {
    const key = customerKey(row.customerPhone, row.customerName)
    const list = groups.get(key)
    if (list) {
      list.push(row)
    } else {
      groups.set(key, [row])
    }
  }
  const withActivity = [...groups].map(([key, list]) => {
    const byStartDesc = [...list].sort((a, b) =>
      a.startAt < b.startAt ? 1 : a.startAt > b.startAt ? -1 : 0
    )
    const latest = byStartDesc[0]
    const completedRows = list.filter((row) => row.status === "completed")
    const latestCompleted = [...completedRows].sort((a, b) =>
      a.startAt < b.startAt ? 1 : a.startAt > b.startAt ? -1 : 0
    )[0]
    const next = list
      .filter(
        (row) => row.status === "confirmed" && Date.parse(row.startAt) > nowMs
      )
      .sort((a, b) =>
        a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0
      )[0]
    const customer: OwnerCustomer = {
      key,
      name: latest.customerName,
      phone: latest.customerPhone,
      bookings: list.length,
      completed: completedRows.length,
      noShows: list.filter((row) => row.status === "no_show").length,
      cancelled: list.filter((row) => row.status === "cancelled").length,
      lastVisit: latestCompleted
        ? zonedDateTime(latestCompleted.startAt, timeZone).date
        : null,
      nextBooking: next
        ? zonedDateTime(next.startAt, timeZone).date
        : null,
      spentMinor: completedRows.reduce(
        (sum, row) => sum + (row.priceMinor ?? 0),
        0
      ),
      currency,
    }
    return {
      customer,
      nextStart: next ? next.startAt : null,
      lastActivity: latest.startAt,
    }
  })
  // Next booking first (soonest), then latest activity.
  withActivity.sort((a, b) => {
    if (a.nextStart !== null && b.nextStart !== null) {
      if (a.nextStart !== b.nextStart) {
        return a.nextStart < b.nextStart ? -1 : 1
      }
    } else if (a.nextStart !== null) {
      return -1
    } else if (b.nextStart !== null) {
      return 1
    }
    if (a.lastActivity === b.lastActivity) {
      return 0
    }
    return a.lastActivity < b.lastActivity ? 1 : -1
  })
  return withActivity.slice(0, 500).map((entry) => entry.customer)
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

export async function getCustomers(
  businessId: string
): Promise<OwnerCustomer[]> {
  const business = await ownedBusinessOrNotFound(businessId)
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.businessId, business.id))
  return buildCustomers(rows, Date.now(), business.timezone, business.currency)
}

export async function getCustomerBookings(
  businessId: string,
  key: string
): Promise<OwnerBooking[]> {
  const business = await ownedBusinessOrNotFound(businessId)
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.businessId, business.id))
    .orderBy(desc(bookings.startAt))
  const listed = rows
    .filter(
      (row) => customerKey(row.customerPhone, row.customerName) === key
    )
    .slice(0, 100)
  const addonsByBooking = await getBookingAddons(
    listed.map((row) => row.id)
  )
  return listed.map((row) =>
    toOwnerBooking(row, business.timezone, addonsByBooking.get(row.id) ?? [])
  )
}
