import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { noteBusinessClaimed } from "@/lib/partner-events"
import { ownerHasFeature } from "@/lib/plan-access"

// Temporary: anyone who picks a business takes it over (the last one wins). A real ownership check comes later.
export async function claimBusinessForUser(
  userId: string,
  slug: string
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; error: "not_found" | "locked" }
> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) {
    return { ok: false, error: "not_found" }
  }
  if (business.ownerId === userId) {
    return { ok: true, businessId: business.id }
  }
  // Another business needs a plan that has more than one
  // (docs/plans/subscriptions.md, P5).
  if (!(await ownerHasFeature(userId, "multipleBusinesses"))) {
    return { ok: false, error: "locked" }
  }
  // The new owner must check the details on the setup page, so the old confirmation is void.
  await db
    .update(businesses)
    .set({ ownerId: userId, detailsConfirmedAt: null })
    .where(eq(businesses.id, business.id))
  // A partner app that invited this business hears of it
  // (docs/plans/sales-connection.md, SC7); the claim stands either way.
  await noteBusinessClaimed(business.id).catch(console.error)
  return { ok: true, businessId: business.id }
}
