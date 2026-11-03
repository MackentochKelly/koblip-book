import { asc, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { businesses, businessPhotos } from "@/lib/db/schema"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { placePhotoUrl } from "@/lib/place-photo"

// A small preview can load while the business import/AI work is still running.
// Photo names are fetched fresh, never persisted or cached.
export async function GET(request: NextRequest) {
  let placeId = request.nextUrl.searchParams.get("place")
  const slug = request.nextUrl.searchParams.get("business")
  const unavailable = () =>
    new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    })
  if (slug) {
    if (!/^[a-z0-9-]{1,200}$/.test(slug)) return unavailable()
    const [business] = await db
      .select({ id: businesses.id, placeId: businesses.googlePlaceId })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1)
    if (!business) return unavailable()
    const [photo] = await db
      .select({ url: businessPhotos.url })
      .from(businessPhotos)
      .where(eq(businessPhotos.businessId, business.id))
      .orderBy(asc(businessPhotos.position))
      .limit(1)
    if (photo)
      return new Response(null, {
        status: 302,
        headers: { Location: photo.url, "Cache-Control": "no-store" },
      })
    placeId = business.placeId
  }
  if (!placeId || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return unavailable()
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) return unavailable()
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos" },
        cache: "no-store",
        signal: AbortSignal.timeout(ONBOARDING_RULES.photoTimeoutMs),
      }
    )
    if (!response.ok) return unavailable()
    const data = (await response.json()) as { photos?: { name?: string }[] }
    const name = data.photos?.[0]?.name
    if (!name || !/^places\/[^/]+\/photos\/[^/]+$/.test(name))
      return unavailable()
    return new Response(null, {
      status: 302,
      headers: {
        Location: placePhotoUrl(name, "thumb"),
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return unavailable()
  }
}
