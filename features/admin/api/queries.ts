import "server-only"

import { and, asc, count, desc, eq, gt, gte, isNotNull, isNull, sql } from "drizzle-orm"
import { getAccountVoices } from "@/lib/account-voices"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookings, businesses, customers, serviceCategories, services, teamInvites, teamMembers, teamMemberHours, ownerVoices, user } from "@/lib/db/schema"
import { paymentOf, type PaymentStatus } from "@/lib/payment-rules"

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
  team?: Array<{ id: string; name: string; phone: string | null; email: string | null; description: string | null; hours: Array<typeof teamMemberHours.$inferSelect> }>
  // Customers the owner added by hand (booking customers live in bookings).
  customers?: Array<{ id: string; name: string; phone: string | null }>
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
  const [members, hours, saved] = await Promise.all([
    db.select().from(teamMembers).innerJoin(businesses, eq(businesses.id, teamMembers.businessId)).where(realBusiness).orderBy(asc(teamMembers.position)),
    db.select().from(teamMemberHours).innerJoin(businesses, eq(businesses.id, teamMemberHours.businessId)).where(realBusiness).orderBy(asc(teamMemberHours.weekday), asc(teamMemberHours.opensAt)),
    db.select({ id: customers.id, businessId: customers.businessId, name: customers.name, phone: customers.phone }).from(customers).innerJoin(businesses, eq(businesses.id, customers.businessId)).where(realBusiness).orderBy(desc(customers.createdAt)),
  ])
  return rows.map((row) => ({ ...row, team: members.filter((m) => m.team_members.businessId === row.id).map(({ team_members: member }) => ({
    id: member.id, name: member.name, phone: member.phone, email: member.email, description: member.description, hours: hours.filter((h) => h.team_member_hours.teamMemberId === member.id).map((h) => h.team_member_hours),
  })), customers: saved.filter((c) => c.businessId === row.id).map(({ id, name, phone }) => ({ id, name, phone })) }))
}

export interface AdminOwner {
  id: string
  name: string
  // Null for an account made by phone (its email is a placeholder).
  email: string | null
  // The verified phone (phone sign-in), as +18095550123.
  phone: string | null
  image: string | null
  banned: boolean
  createdAt: string
  businesses: number
  // Bookings that are this account's as a client (made or claimed with it).
  bookings: number
  voice: { voiceId: string; name: string | null } | null
}

export async function getOwners(): Promise<AdminOwner[]> {
  await requireAdmin()
  const owned = db
    .select({ ownerId: businesses.ownerId, n: count().as("n") })
    .from(businesses)
    .where(realBusiness)
    .groupBy(businesses.ownerId)
    .as("owned")
  const booked = db
    .select({
      userId: bookings.customerUserId,
      bookingCount: count().as("booking_count"),
    })
    .from(bookings)
    .groupBy(bookings.customerUserId)
    .as("booked")
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      image: user.image,
      banned: user.banned,
      voiceId: ownerVoices.voiceId,
      createdAt: user.createdAt,
      businesses: sql<number>`coalesce(${owned.n}, 0)`,
      bookings: sql<number>`coalesce(${booked.bookingCount}, 0)`,
    })
    .from(user)
    .leftJoin(owned, eq(owned.ownerId, user.id))
    .leftJoin(booked, eq(booked.userId, user.id))
    .leftJoin(ownerVoices, eq(ownerVoices.ownerId, user.id))
    .where(realUser)
    .orderBy(desc(user.createdAt))
    .limit(MAX_ROWS)
  const voices = await getAccountVoices()
  const names = new Map(voices?.map((voice) => [voice.voiceId, voice.name]))
  return rows.map(({ voiceId, phoneNumber, phoneNumberVerified, ...row }) => ({
    ...row,
    email: isPhoneAccountEmail(row.email) ? null : row.email,
    phone: phoneNumberVerified ? phoneNumber : null,
    voice: voiceId === null ? null : { voiceId, name: names.get(voiceId) ?? null },
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
  // A reward was redeemed on it (docs/plans/rewards.md, RW-13).
  reward: boolean
  // Paying outside the app, when the booking tracks it: the way's name
  // (null at the visit) and where it stands.
  // proof: the customer added a picture of the payment.
  payment: { way: string | null; status: PaymentStatus; proof: boolean } | null
}

export async function getBookings(): Promise<AdminBooking[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      timezone: businesses.timezone,
      businessName: businesses.name,
      serviceName: bookings.serviceName,
      customerName: bookings.customerName,
      status: bookings.status,
      paymentChoice: bookings.paymentChoice,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
      paymentReference: bookings.paymentReference,
      paymentProof: bookings.paymentProof,
      rewardId: bookings.rewardId,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(realBusiness)
    .orderBy(desc(bookings.createdAt))
    .limit(MAX_ROWS)
  return rows.map(
    ({ paymentChoice, paymentMethod, paymentStatus, paymentReference, paymentProof, rewardId, ...row }) => {
      const payment = paymentOf({
        paymentChoice,
        paymentMethod,
        paymentStatus,
        paymentReference,
        paymentProof,
      })
      return {
        ...row,
        reward: rewardId !== null,
        payment: payment && {
          way: payment.method?.name ?? null,
          status: payment.status,
          proof: payment.hasProof,
        },
      }
    }
  )
}

export interface AdminTeamAccount {
  teamMemberId: string
  memberName: string
  businessName: string
  slug: string
  email: string
}

export interface AdminTeamInvite {
  id: string
  memberName: string
  businessName: string
  expiresAt: string
}

// Team members who joined with their own account, and the invite links
// still open (docs/plans/team-accounts.md). Demo copies are left out.
export async function getTeamAccounts(): Promise<{
  joined: AdminTeamAccount[]
  invites: AdminTeamInvite[]
}> {
  await requireAdmin()
  const [joined, invites] = await Promise.all([
    db
      .select({
        teamMemberId: teamMembers.id,
        memberName: teamMembers.name,
        businessName: businesses.name,
        slug: businesses.slug,
        email: user.email,
      })
      .from(teamMembers)
      .innerJoin(businesses, eq(businesses.id, teamMembers.businessId))
      .innerJoin(user, eq(user.id, teamMembers.userId))
      .where(and(realBusiness, isNotNull(teamMembers.userId)))
      .orderBy(asc(businesses.name), asc(teamMembers.position))
      .limit(MAX_ROWS),
    db
      .select({
        id: teamInvites.id,
        memberName: teamMembers.name,
        businessName: businesses.name,
        expiresAt: teamInvites.expiresAt,
      })
      .from(teamInvites)
      .innerJoin(businesses, eq(businesses.id, teamInvites.businessId))
      .innerJoin(teamMembers, eq(teamMembers.id, teamInvites.teamMemberId))
      .where(
        and(
          realBusiness,
          isNull(teamInvites.usedAt),
          gt(teamInvites.expiresAt, new Date().toISOString())
        )
      )
      .orderBy(desc(teamInvites.createdAt))
      .limit(MAX_ROWS),
  ])
  return { joined, invites }
}

export interface AdminServiceCategory {
  id: string
  name: string
  // How many services are in it.
  services: number
}

export interface AdminCategoryBusiness {
  id: string
  name: string
  categories: AdminServiceCategory[]
}

// Each business with service categories, by name, and its categories in
// the owner's order with how many services each holds
// (docs/plans/service-categories.md). Demo copies are left out.
export async function getServiceCategories(): Promise<AdminCategoryBusiness[]> {
  await requireAdmin()
  const serviceCount = db
    .select({ categoryId: services.categoryId, n: count().as("n") })
    .from(services)
    .where(isNotNull(services.categoryId))
    .groupBy(services.categoryId)
    .as("service_count")
  const rows = await db
    .select({
      id: serviceCategories.id,
      name: serviceCategories.name,
      services: sql<number>`coalesce(${serviceCount.n}, 0)`,
      businessId: businesses.id,
      businessName: businesses.name,
    })
    .from(serviceCategories)
    .innerJoin(businesses, eq(businesses.id, serviceCategories.businessId))
    .leftJoin(serviceCount, eq(serviceCount.categoryId, serviceCategories.id))
    .where(realBusiness)
    // By id too, so two businesses with one name stay apart.
    .orderBy(asc(businesses.name), asc(businesses.id), asc(serviceCategories.position))
    .limit(MAX_ROWS)
  const list: AdminCategoryBusiness[] = []
  for (const { businessId, businessName, ...category } of rows) {
    const last = list.at(-1)
    if (last?.id === businessId) last.categories.push(category)
    else list.push({ id: businessId, name: businessName, categories: [category] })
  }
  return list
}
