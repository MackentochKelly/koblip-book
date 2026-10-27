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
import type { BusinessPageData, PagePhoto } from "../types"

interface GooglePhotoAttribution {
  displayName?: string
  uri?: string
}

interface GooglePhoto {
  name?: string
  authorAttributions?: GooglePhotoAttribution[]
}

// Fresh from Google on each page view, never stored: a photo name may not
// be cached and can expire, so it always comes from a new Details call.
// Google failures return no photos; the page still loads.
async function getGooglePhotos(
  googlePlaceId: string | null
): Promise<PagePhoto[]> {
  if (!googlePlaceId) {
    return []
  }
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    return []
  }
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${googlePlaceId}?languageCode=en`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "photos",
        },
        cache: "no-store",
      }
    )
    if (!res.ok) {
      return []
    }
    const data = (await res.json()) as { photos?: GooglePhoto[] }
    const photos = Array.isArray(data.photos) ? data.photos.slice(0, 10) : []
    return photos
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
  } catch {
    return []
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

  const photos: PagePhoto[] =
    ownPhotos.length > 0
      ? ownPhotos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          credit: null,
        }))
      : await getGooglePhotos(business.googlePlaceId)

  return { business, hours, services: serviceRows, team, photos }
}

export const getBusinessPage = cache(loadBusinessPage)
