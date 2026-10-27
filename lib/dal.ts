import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "./auth"

export interface OwnerSession {
  userId: string
  name: string
  email: string
}

export const getSession = cache(
  async (): Promise<OwnerSession | null> => {
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
    }
  }
)

export async function requireOwner(next?: string): Promise<OwnerSession> {
  const session = await getSession()
  if (!session) {
    redirect(
      "/sign-in" + (next ? "?next=" + encodeURIComponent(next) : "")
    )
  }
  return session
}
