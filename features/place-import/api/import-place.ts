import "server-only"
import { eq, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businessHours, businesses, paymentMethods } from "@/lib/db/schema"
import { SAMPLE_PAYMENT_METHODS } from "@/lib/payment-rules"
import { writeAbout, type AboutWords } from "./write-about"
import { fetchPlace, type GooglePlace } from "./fetch-place"
import { findPlaceId } from "./find-place-id"
import {
  mapPlace,
  slugBase,
  specificTypes,
  uniqueSlug,
} from "../utils/map-place"

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Meta AI writes a new business's About text from our own facts only,
// and names its category when Google gave only a catch-all. Null when the
// AI is off or fails.
async function aiWords(
  place: GooglePlace,
  business: {
    name: string
    category?: string | null
    address?: string | null
    website?: string | null
  },
  hours: Array<{ weekday: number }>
): Promise<AboutWords | null> {
  const openingDays = [...new Set(hours.map((row) => row.weekday))]
    .sort((a, b) => a - b)
    .map((weekday) => WEEKDAY_SHORT[weekday])
  return writeAbout({
    name: business.name,
    category: business.category ?? null,
    address: business.address ?? null,
    openingDays,
    placeTypes: specificTypes(place),
    website: business.website ?? null,
    nameCategory: !business.category,
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
// editorialSummary is never stored), and so does the category when
// Google's is only a catch-all like "Services".
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
  const mapped = mapPlace(place)
  const hours = mapped.hours
  const words = await aiWords(place, mapped.business, hours)
  const description = words?.about || null
  const business = {
    ...mapped.business,
    category: mapped.business.category ?? words?.category ?? null,
  }

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
        db.insert(businesses).values({ ...business, description, id, slug, setupFinishedAt: null }),
        ...hoursInsert(id, hours),
        // Every business starts with the standard ways to pay, holding
        // sample details (lib/payment-rules.ts).
        db.insert(paymentMethods).values(
          SAMPLE_PAYMENT_METHODS.map((method, position) => ({
            businessId: id,
            ...method,
            position,
          }))
        ),
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
