import type { businesses } from "@/lib/db/schema"
import type { GooglePlace } from "../api/fetch-place"
import { currencyByCountry } from "./currency-by-country"

type BusinessInsert = typeof businesses.$inferInsert

export interface MappedHours {
  weekday: number
  opensAt: string
  closesAt: string
}

export interface MappedPlace {
  business: Omit<BusinessInsert, "id" | "slug">
  hours: MappedHours[]
}

function toTime(point: { hour: number; minute: number }): string {
  return `${String(point.hour).padStart(2, "0")}:${String(point.minute).padStart(2, "0")}`
}

function mapStatus(businessStatus: string | undefined): string | null {
  switch (businessStatus) {
    case "OPERATIONAL":
      return "operational"
    case "CLOSED_TEMPORARILY":
      return "temporarily_closed"
    case "CLOSED_PERMANENTLY":
      return "closed"
    default:
      return null
  }
}

function countryCode(place: GooglePlace): string | null {
  const component = place.addressComponents?.find((item) =>
    item.types?.includes("country")
  )
  return component?.shortText ?? null
}

// Google's catch-all types: "service" and "store" from Table A, the rest
// from Table B (developers.google.com/maps/documentation/places/
// web-service/place-types). As a primary type they say nothing about the
// business (a photo studio is just "service"), so Muse names it instead.
export const CATCH_ALL_PLACE_TYPES: ReadonlySet<string> = new Set([
  "service",
  "store",
  "establishment",
  "point_of_interest",
  "food",
  "health",
  "finance",
])

// Google's own category name, or null when its primary type is a
// catch-all or it has none.
export function googleCategory(place: GooglePlace): string | null {
  if (place.primaryType && CATCH_ALL_PLACE_TYPES.has(place.primaryType)) {
    return null
  }
  return place.primaryTypeDisplayName?.text ?? null
}

// The place's specific types in words ("hair care"), for Muse to go on.
export function specificTypes(place: GooglePlace): string[] {
  return (place.types ?? [])
    .filter((type) => !CATCH_ALL_PLACE_TYPES.has(type))
    .map((type) => type.replaceAll("_", " "))
}

// Google place → the businesses row (without id/slug) plus the hours rows.
// Pure: no fetch, no database.
export function mapPlace(place: GooglePlace): MappedPlace {
  const hours: MappedHours[] = (place.regularOpeningHours?.periods ?? []).map(
    (period) => {
      if (!period.close) {
        // Open 24 hours: Google sends an open at 00:00 with no close.
        return { weekday: period.open.day, opensAt: "00:00", closesAt: "00:00" }
      }
      return {
        weekday: period.open.day,
        opensAt: toTime(period.open),
        closesAt: toTime(period.close),
      }
    }
  )

  return {
    business: {
      googlePlaceId: place.id,
      name: place.displayName?.text ?? "",
      phone: place.internationalPhoneNumber ?? null,
      address: place.formattedAddress ?? null,
      timezone: place.timeZone?.id ?? "UTC",
      currency: currencyByCountry(countryCode(place)),
      category: googleCategory(place),
      website: place.websiteUri ?? null,
      status: mapStatus(place.businessStatus),
    },
    hours,
  }
}

// Lowercase ASCII words joined by "-".
export function slugify(name: string): string {
  const ascii = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  const words = ascii
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  return words.join("-")
}

// The link's start: the name, or for a name with no Latin letters or
// digits (東京理容) the business type Google gives in English, or else
// "business". Never empty.
export function slugBase(name: string, category: string | null): string {
  return slugify(name) || slugify(category ?? "") || "business"
}

// First free slug: the base, then "-2", "-3", …
export function uniqueSlug(
  base: string,
  isTaken: (slug: string) => boolean
): string {
  if (!isTaken(base)) {
    return base
  }
  let suffix = 2
  while (isTaken(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}
