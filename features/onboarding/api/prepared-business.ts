import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessHours, businesses } from "@/lib/db/schema"
import type { PreparedBusiness } from "../types"

export function failed(error: unknown): PreparedBusiness {
  console.error(error instanceof Error ? error.message : String(error))
  return { ok: false, error: "failed" }
}

// Reads a saved business row plus its first photo: what the sign-up card
// shows for it.
export async function readPreparedBusiness(
  slug: string
): Promise<PreparedBusiness> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) {
    return failed("prepareBusiness imported no business row")
  }
  const hours = await db
    .select({ weekday: businessHours.weekday })
    .from(businessHours)
    .where(eq(businessHours.businessId, business.id))
  return {
    ok: true,
    slug,
    name: business.name,
    address: business.address,
    photoUrl: `/api/business-preview-photo?business=${encodeURIComponent(slug)}`,
    category: business.category,
    phone: business.phone,
    website: business.website,
    openDays: new Set(hours.map((hour) => hour.weekday)).size,
  }
}
