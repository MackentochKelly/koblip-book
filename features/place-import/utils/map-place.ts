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
      description: place.editorialSummary?.text ?? null,
      phone: place.internationalPhoneNumber ?? null,
      address: place.formattedAddress ?? null,
      timezone: place.timeZone?.id ?? "UTC",
      currency: currencyByCountry(countryCode(place)),
      category: place.primaryTypeDisplayName?.text ?? null,
      rating: place.rating ?? null,
      reviewCount: place.userRatingCount ?? null,
      website: place.websiteUri ?? null,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      mapsUrl: place.googleMapsUri ?? null,
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
