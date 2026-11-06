import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { parsePhoneNumberFromString } from "libphonenumber-js"
import { auth } from "./auth"
import { loginHref } from "./auth-links"
import { db } from "./db"
import { businesses, teamMembers } from "./db/schema"
import { isPhoneAccountEmail } from "./phone-sign-in"

export interface OwnerSession {
  userId: string
  name: string
  // Null for an account made by phone (its email is a placeholder).
  email: string | null
  // The phone a sign-in code proved, as +18095550123; null without one.
  phone: string | null
  // What names the account on screen: its email, else its phone.
  contact: string
  // The photo from Google login; null for email accounts.
  image: string | null
  // False until a password account opens its sign-up email link.
  emailVerified: boolean
  // A home page demo visitor (Better Auth's anonymous plugin): no account,
  // owns only their demo copy. Kept out of everything for real owners.
  isGuest: boolean
}

export const getSession = cache(async (): Promise<OwnerSession | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    return null
  }
  const email = isPhoneAccountEmail(session.user.email)
    ? null
    : session.user.email
  const phone = session.user.phoneNumberVerified
    ? (session.user.phoneNumber ?? null)
    : null
  return {
    userId: session.user.id,
    name: session.user.name,
    email,
    phone,
    contact:
      email ??
      (phone && parsePhoneNumberFromString(phone)?.formatInternational()) ??
      phone ??
      "",
    image: session.user.image ?? null,
    emailVerified: session.user.emailVerified,
    isGuest: session.user.isAnonymous === true,
  }
})

export async function requireOwner(next?: string): Promise<OwnerSession> {
  const session = await getSession()
  if (!session) {
    redirect(loginHref({ next }))
  }
  return session
}

// A real owner's account, for what only real owners do (claim a business,
// set one up). A demo guest goes to log in, like someone signed out.
export async function requireAccount(next?: string): Promise<OwnerSession> {
  const session = await getSession()
  if (!session || session.isGuest) {
    redirect(loginHref({ next }))
  }
  return session
}

// The app owner's admin area: a signed-in account that Better Auth's admin
// plugin counts as an admin (ADMIN_USER_IDS). Anyone else gets "not found",
// so the area doesn't show that it exists.
export async function requireAdmin(): Promise<OwnerSession> {
  const session = await requireAccount("/admin")
  const { success } = await auth.api.userHasPermission({
    body: { userId: session.userId, permissions: { user: ["list"] } },
  })
  if (!success) {
    notFound()
  }
  return session
}

export interface TeamSeat {
  teamMemberId: string
  name: string
  photoUrl: string | null
  business: {
    id: string
    slug: string
    name: string
    timezone: string
    currency: string
  }
}

// The team member seats this account joined (docs/plans/team-accounts.md),
// one per business.
export const getTeamSeats = cache(async (userId: string): Promise<TeamSeat[]> => {
  const rows = await db
    .select({
      teamMemberId: teamMembers.id,
      name: teamMembers.name,
      photoUrl: teamMembers.photoUrl,
      businessId: businesses.id,
      slug: businesses.slug,
      businessName: businesses.name,
      timezone: businesses.timezone,
      currency: businesses.currency,
    })
    .from(teamMembers)
    .innerJoin(businesses, eq(businesses.id, teamMembers.businessId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(businesses.name))
  return rows.map((row) => ({
    teamMemberId: row.teamMemberId,
    name: row.name,
    photoUrl: row.photoUrl,
    business: {
      id: row.businessId,
      slug: row.slug,
      name: row.businessName,
      timezone: row.timezone,
      currency: row.currency,
    },
  }))
})

// A team member's own area: the signed-in account must be the one that
// joined as this team member. Anyone else gets "not found", like the admin
// area, so it doesn't show who is on which team.
export async function requireTeamMember(
  teamMemberId: string
): Promise<OwnerSession & { seat: TeamSeat }> {
  const session = await requireAccount(`/team/${teamMemberId}`)
  const seat = (await getTeamSeats(session.userId)).find(
    (item) => item.teamMemberId === teamMemberId
  )
  if (!seat) {
    notFound()
  }
  return { ...session, seat }
}
