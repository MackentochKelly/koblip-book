import "server-only"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"

// Sets ownerId to the user only if it is still null, in one conditional
// UPDATE. Already yours → ok; owned by someone else (or lost a race) →
// "owned"; unknown slug → "not_found".
export async function claimBusinessForUser(
  userId: string,
  slug: string
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; error: "owned" | "not_found" }
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
  if (business.ownerId) {
    return { ok: false, error: "owned" }
  }
  await db
    .update(businesses)
    .set({ ownerId: userId })
    .where(
      and(eq(businesses.id, business.id), isNull(businesses.ownerId))
    )
  const [fresh] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, business.id))
    .limit(1)
  if (fresh?.ownerId !== userId) {
    return { ok: false, error: "owned" }
  }
  return { ok: true, businessId: business.id }
}
