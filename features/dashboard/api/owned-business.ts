import "server-only"

import { eq } from "drizzle-orm"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"

export async function ownedBusiness(businessId: string) {
  const session = await requireOwner()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId) {
    return null
  }
  return { business, userId: session.userId }
}
