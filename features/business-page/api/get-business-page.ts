import "server-only"
import { cache } from "react"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  businessHours,
  businessPhotos,
  businesses,
  services,
  teamMembers,
} from "@/lib/db/schema"
import type { Amenity, BusinessPageData, PagePhoto, PageReview } from "../types"
import { mapAmenities } from "../utils/map-amenities"

interface GooglePhotoAttribution {
  displayName?: string
  uri?: string
}

interface GooglePhoto {
  name?: string
  authorAttributions?: GooglePhotoAttribution[]
}

interface GoogleReview {
  rating?: number
  relativePublishTimeDescription?: string
  text?: { text?: string; languageCode?: string }
  authorAttribution?: {
    displayName?: string
    uri?: string
    photoUri?: string
  }
}

interface GoogleDetails {
  photos?: GooglePhoto[]
  reviews?: GoogleReview[]
  accessibilityOptions?: Record<string, boolean | undefined>
  parkingOptions?: Record<string, boolean | undefined>
  paymentOptions?: {
    acceptsCreditCards?: boolean
    acceptsDebitCards?: boolean
    acceptsCashOnly?: boolean
    acceptsNfc?: boolean
  }
  allowsDogs?: boolean
  goodForChildren?: boolean
  restroom?: boolean
}

interface GoogleExtras {
  photos: PagePhoto[]
  reviews: PageReview[]
  amenities: Amenity[]
}

const EMPTY_EXTRAS: GoogleExtras = { photos: [], reviews: [], amenities: [] }

const DETAILS_FIELD_MASK =
  "photos,reviews,accessibilityOptions,parkingOptions,paymentOptions,allowsDogs,goodForChildren,restroom"

// Fresh from Google on each page view, never stored: reviews, amenities and
// photo names may not be cached, so they always come from a new Details
// call. Google failures return no extras; the page still loads.
async function getGoogleExtras(
  googlePlaceId: string | null
): Promise<GoogleExtras> {
  if (!googlePlaceId) {
    return EMPTY_EXTRAS
  }
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    return EMPTY_EXTRAS
  }
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${googlePlaceId}?languageCode=en`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) {
      return EMPTY_EXTRAS
    }
    const data = (await res.json()) as GoogleDetails
    const googlePhotos = Array.isArray(data.photos)
      ? data.photos.slice(0, 10)
      : []
    const photos: PagePhoto[] = googlePhotos
      .filter((photo) => typeof photo.name === "string" && photo.name)
      .map((photo) => {
        const credit = photo.authorAttributions?.[0]
        return {
          id: photo.name as string,
          url: `/api/place-photo?name=${encodeURIComponent(photo.name as string)}`,
          credit: credit?.displayName
            ? { name: credit.displayName, uri: credit.uri ?? null }
            : null,
        }
      })
    // Reviews without text are skipped. An author's photo URL is returned
    // as is, never proxied.
    const reviews: PageReview[] = (
      Array.isArray(data.reviews) ? data.reviews : []
    )
      .filter((review) => review.text?.text)
      .map((review) => ({
        author: {
          name: review.authorAttribution?.displayName ?? "",
          uri: review.authorAttribution?.uri ?? null,
          photoUrl: review.authorAttribution?.photoUri ?? null,
        },
        rating: review.rating ?? 0,
        when: review.relativePublishTimeDescription ?? "",
        text: review.text?.text as string,
      }))
    const amenities = mapAmenities({
      accessibilityOptions: data.accessibilityOptions,
      parkingOptions: data.parkingOptions,
      paymentOptions: data.paymentOptions,
      allowsDogs: data.allowsDogs,
      goodForChildren: data.goodForChildren,
      restroom: data.restroom,
    })
    return { photos, reviews, amenities }
  } catch {
    return EMPTY_EXTRAS
  }
}

async function loadBusinessPage(
  slug: string
): Promise<BusinessPageData | null> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) {
    return null
  }

  const [hours, serviceRows, team, ownPhotos] = await Promise.all([
    db
      .select()
      .from(businessHours)
      .where(eq(businessHours.businessId, business.id))
      .orderBy(asc(businessHours.weekday), asc(businessHours.opensAt)),
    db
      .select()
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(asc(services.position)),
    db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id))
      .orderBy(asc(teamMembers.position)),
    db
      .select()
      .from(businessPhotos)
      .where(eq(businessPhotos.businessId, business.id))
      .orderBy(asc(businessPhotos.position)),
  ])

  const extras = await getGoogleExtras(business.googlePlaceId)

  // The business's own photos win over Google's.
  const photos: PagePhoto[] =
    ownPhotos.length > 0
      ? ownPhotos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          credit: null,
        }))
      : extras.photos

  return {
    business,
    hours,
    services: serviceRows,
    team,
    photos,
    reviews: extras.reviews,
    amenities: extras.amenities,
  }
}

export const getBusinessPage = cache(loadBusinessPage)
