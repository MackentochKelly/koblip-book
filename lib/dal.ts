import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "./auth"

export interface OwnerSession {
  userId: string
  name: string
  email: string
  // The photo from Google login; null for email accounts.
  image: string | null
  // False until a password account opens its sign-up email link.
  emailVerified: boolean
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
  }
})

export async function requireOwner(next?: string): Promise<OwnerSession> {
  const session = await getSession()
  if (!session) {
    redirect("/login" + (next ? "?next=" + encodeURIComponent(next) : ""))
  }
  return session
}
