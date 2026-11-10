import "server-only"

import { eq } from "drizzle-orm"
import { requireAccount } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"

// The signed-in owner's own real business (never a demo copy), or null.
// The id comes from the browser, so ownership is checked here.
export async function ownedBusiness(businessId: unknown) {
  if (typeof businessId !== "string" || !businessId) {
    return null
  }
  const session = await requireAccount()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId || business.isDemo) {
    return null
  }
  return { business, userId: session.userId }
}
