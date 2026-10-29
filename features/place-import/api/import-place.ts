import "server-only"
import { eq, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businessHours, businesses } from "@/lib/db/schema"
import { writeAbout } from "./write-about"
import { fetchPlace } from "./fetch-place"
import { findPlaceId } from "./find-place-id"
import { mapPlace, slugBase, uniqueSlug } from "../utils/map-place"

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Meta AI writes a new business's About text from our own facts only.
// Null when the AI is off or fails.
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

type MappedPlace = ReturnType<typeof mapPlace>

// The page slug of the business already saved from this Google place, if
// any.
async function savedSlug(placeId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.googlePlaceId, placeId))
    .limit(1)
  return row?.slug ?? null
}

// Hours rows for one business, as a batch item (none when Google has no
// hours).
function hoursInsert(businessId: string, hours: MappedPlace["hours"]) {
  return hours.length > 0
    ? [
        db
          .insert(businessHours)
          .values(hours.map((row) => ({ ...row, businessId }))),
      ]
    : []
}

// Saves a Google place as a new business and returns its slug. A place
// that is already saved is never written again: its owner's name, phone,
// hours and everything else stay as they are, and neither Google nor Meta
// AI is asked. The About text comes from Meta AI (Google's
// editorialSummary is never stored).
//
// Saves go through saveAll (see lib/db/save-all.ts). Two imports at the
// same moment: the unique slug and googlePlaceId columns decide who wins;
// the loser uses the business that was saved, or takes the next slug.
export async function importPlaceById(
  placeId: string,
  sessionToken?: string
): Promise<string> {
  const saved = await savedSlug(placeId)
  if (saved) {
    return saved
  }

  const place = await fetchPlace(placeId, sessionToken)
  const { business, hours } = mapPlace(place)
  const description = (await aiDescription(business, hours)) || null

  const base = slugBase(business.name, business.category ?? null)
  const conflicts = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(like(businesses.slug, `${base}%`))
  const taken = new Set(conflicts.map((row) => row.slug))
  const id = crypto.randomUUID()
  for (;;) {
    const slug = uniqueSlug(base, (candidate) => taken.has(candidate))
    try {
      await saveAll([
        db.insert(businesses).values({ ...business, description, id, slug }),
        ...hoursInsert(id, hours),
      ])
      return slug
    } catch (error) {
      // Another import saved first: this same place, or another place
      // with this slug. Anything else is a real failure.
      const same = await savedSlug(placeId)
      if (same) {
        return same
      }
      const [clash] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.slug, slug))
        .limit(1)
      if (!clash) {
        throw error
      }
      taken.add(slug)
    }
  }
}

// Same import from pasted text or a Maps link: resolves the place ID
// first, then imports by ID.
export async function importPlace(input: string): Promise<string> {
  return importPlaceById(await findPlaceId(input))
}
