import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"

// Temporary: anyone who picks a business takes it over (the last one wins). A real ownership check comes later.
export async function claimBusinessForUser(
  userId: string,
  slug: string
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; error: "not_found" }
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
  // The new owner must check the details on the setup page, so the old confirmation is void.
  await db
    .update(businesses)
    .set({ ownerId: userId, detailsConfirmedAt: null })
    .where(eq(businesses.id, business.id))
  return { ok: true, businessId: business.id }
}
