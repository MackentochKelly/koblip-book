import "server-only"
import { eq, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessHours, businesses } from "@/lib/db/schema"
import { fetchPlace } from "./fetch-place"
import { findPlaceId } from "./find-place-id"
import { mapPlace, slugify, uniqueSlug } from "../utils/map-place"

// Finds the place, fetches its details, maps and saves it in one
// transaction. An existing import (same googlePlaceId) is updated and gets
// fresh hours; its slug, services, team and photos are kept. Returns the slug.
export async function importPlace(input: string): Promise<string> {
  const placeId = await findPlaceId(input)
  const place = await fetchPlace(placeId)
  const { business, hours } = mapPlace(place)

  const [existing] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.googlePlaceId, placeId))
    .limit(1)
  if (existing) {
    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set(business)
        .where(eq(businesses.id, existing.id))
      await tx
        .delete(businessHours)
        .where(eq(businessHours.businessId, existing.id))
      if (hours.length > 0) {
        await tx
          .insert(businessHours)
          .values(hours.map((row) => ({ ...row, businessId: existing.id })))
      }
    })
    return existing.slug
  }

  const base = slugify(business.name)
  const conflicts = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(like(businesses.slug, `${base}%`))
  const taken = new Set(conflicts.map((row) => row.slug))
  const slug = uniqueSlug(base, (candidate) => taken.has(candidate))
  const id = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(businesses).values({ ...business, id, slug })
    if (hours.length > 0) {
      await tx
        .insert(businessHours)
        .values(hours.map((row) => ({ ...row, businessId: id })))
    }
  })
  return slug
}
