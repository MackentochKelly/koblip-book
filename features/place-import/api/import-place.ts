import "server-only"
import { eq, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessHours, businesses } from "@/lib/db/schema"
import { writeAbout } from "./write-about"
import { fetchPlace } from "./fetch-place"
import { findPlaceId } from "./find-place-id"
import { mapPlace, slugify, uniqueSlug } from "../utils/map-place"

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Meta AI writes the About text from our own facts only, and only when the
// business still has no description. Null when the AI is off or fails.
async function aiDescription(
  business: {
    name: string
    category?: string | null
    address?: string | null
  },
  hours: Array<{ weekday: number }>
): Promise<string | null> {
  const openingDays = [...new Set(hours.map((row) => row.weekday))]
    .sort((a, b) => a - b)
    .map((weekday) => WEEKDAY_SHORT[weekday])
  return writeAbout({
    name: business.name,
    category: business.category ?? null,
    address: business.address ?? null,
    openingDays,
  })
}

// Finds the place, fetches its details, maps and saves it in one
// transaction. An existing import (same googlePlaceId) is updated and gets
// fresh hours; its slug, services, team, photos and description are kept.
// Description order: the owner's existing text, Google's editorialSummary,
// then Meta AI. Returns the slug.
export async function importPlaceById(
  placeId: string,
  sessionToken?: string
): Promise<string> {
  const place = await fetchPlace(placeId, sessionToken)
  const { business, hours } = mapPlace(place)

  const [existing] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.googlePlaceId, placeId))
    .limit(1)
  if (existing) {
    const description =
      existing.description ||
      business.description ||
      (await aiDescription(business, hours)) ||
      null
    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set({ ...business, description })
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
  const description =
    business.description || (await aiDescription(business, hours)) || null
  const id = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(businesses).values({ ...business, description, id, slug })
    if (hours.length > 0) {
      await tx
        .insert(businessHours)
        .values(hours.map((row) => ({ ...row, businessId: id })))
    }
  })
  return slug
}

// Same import from pasted text or a Maps link: resolves the place ID
// first, then imports by ID.
export async function importPlace(input: string): Promise<string> {
  return importPlaceById(await findPlaceId(input))
}
