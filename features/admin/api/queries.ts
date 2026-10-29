import "server-only"

import { and, count, desc, eq, gte, sql } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookings, businesses, user } from "@/lib/db/schema"

// Every list stops here; the newest come first.
const MAX_ROWS = 200

// Home page demo copies and their guests (features/demo) are not real
// businesses or owners: every count and list leaves them out.
const realBusiness = eq(businesses.isDemo, false)
const realUser = sql`coalesce(${user.isAnonymous}, 0) = 0`

export interface AdminOverview {
  businesses: number
  owners: number
  bookings: number
  newOwners: number
}

export async function getOverview(): Promise<AdminOverview> {
  await requireAdmin()
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const [[b], [o], [k], [n]] = await Promise.all([
    db.select({ n: count() }).from(businesses).where(realBusiness),
    db.select({ n: count() }).from(user).where(realUser),
    db
      .select({ n: count() })
      .from(bookings)
      .innerJoin(businesses, eq(businesses.id, bookings.businessId))
      .where(realBusiness),
    db
      .select({ n: count() })
      .from(user)
      .where(and(realUser, gte(user.createdAt, weekAgo))),
  ])
  return {
    businesses: b.n,
    owners: o.n,
    bookings: k.n,
    newOwners: n.n,
  }
}

export interface AdminBusiness {
  id: string
  slug: string
  name: string
  category: string | null
  ownerName: string | null
  ownerEmail: string | null
  bookings: number
}

export async function getBusinesses(): Promise<AdminBusiness[]> {
  await requireAdmin()
  const bookingCount = db
    .select({ businessId: bookings.businessId, n: count().as("n") })
    .from(bookings)
    .groupBy(bookings.businessId)
    .as("booking_count")
  const rows = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      category: businesses.category,
      ownerName: user.name,
      ownerEmail: user.email,
      bookings: sql<number>`coalesce(${bookingCount.n}, 0)`,
    })
    .from(businesses)
    .leftJoin(user, eq(user.id, businesses.ownerId))
    .leftJoin(bookingCount, eq(bookingCount.businessId, businesses.id))
    .where(realBusiness)
    .orderBy(desc(businesses.createdAt))
    .limit(MAX_ROWS)
  return rows
}

export interface AdminOwner {
  id: string
  name: string
  email: string
  image: string | null
  banned: boolean
  createdAt: string
  businesses: number
}

export async function getOwners(): Promise<AdminOwner[]> {
  await requireAdmin()
  const owned = db
    .select({ ownerId: businesses.ownerId, n: count().as("n") })
    .from(businesses)
    .where(realBusiness)
    .groupBy(businesses.ownerId)
    .as("owned")
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      banned: user.banned,
      createdAt: user.createdAt,
      businesses: sql<number>`coalesce(${owned.n}, 0)`,
    })
    .from(user)
    .leftJoin(owned, eq(owned.ownerId, user.id))
    .where(realUser)
    .orderBy(desc(user.createdAt))
    .limit(MAX_ROWS)
  return rows.map((row) => ({
    ...row,
    banned: row.banned === true,
    createdAt: row.createdAt.toISOString(),
  }))
}

export interface AdminBooking {
  id: string
  startAt: string
  timezone: string
  businessName: string
  serviceName: string
  customerName: string
  status: string
}

export async function getBookings(): Promise<AdminBooking[]> {
  await requireAdmin()
  return db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      timezone: businesses.timezone,
      businessName: businesses.name,
      serviceName: bookings.serviceName,
      customerName: bookings.customerName,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(realBusiness)
    .orderBy(desc(bookings.createdAt))
    .limit(MAX_ROWS)
}
