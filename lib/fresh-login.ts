import "server-only"
import { headers } from "next/headers"

import { ACCOUNT_RULES } from "./account-rules"
import { auth } from "./auth"

// Whether this login is recent enough for deleting the account
// (ACCOUNT_RULES.freshLoginHours, Better Auth's freshAge): older, the person
// logs in again first, so nothing is half deleted.
export async function hasFreshLogin(): Promise<boolean> {
  const current = await auth.api.getSession({ headers: await headers() })
  const loggedInAt = current ? new Date(current.session.createdAt).getTime() : 0
  return Date.now() - loggedInAt < ACCOUNT_RULES.freshLoginHours * 3_600_000
}
