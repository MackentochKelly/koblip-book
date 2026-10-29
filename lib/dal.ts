import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "./auth"

export interface OwnerSession {
  userId: string
  name: string
  email: string
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
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    emailVerified: session.user.emailVerified,
    isGuest: session.user.isAnonymous === true,
  }
})

export async function requireOwner(next?: string): Promise<OwnerSession> {
  const session = await getSession()
  if (!session) {
    redirect("/login" + (next ? "?next=" + encodeURIComponent(next) : ""))
  }
  return session
}

// A real owner's account, for what only real owners do (claim a business,
// set one up). A demo guest goes to log in, like someone signed out.
export async function requireAccount(next?: string): Promise<OwnerSession> {
  const session = await getSession()
  if (!session || session.isGuest) {
    redirect("/login" + (next ? "?next=" + encodeURIComponent(next) : ""))
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
