// Google place photos come through app/api/place-photo, which asks Google
// for the size the screen needs (Place Photos (New): maxWidthPx and
// maxHeightPx keep the photo's shape and fit it inside the box).
export const PLACE_PHOTO_PX = {
  // Photos on the business page.
  full: 1600,
  // Small round thumbnails: sharp at 3x on a 32px avatar.
  thumb: 240,
} as const

export type PlacePhotoSize = keyof typeof PLACE_PHOTO_PX

const ROUTE = "/api/place-photo"

export function placePhotoUrl(name: string, size: PlacePhotoSize = "full") {
  const url = `${ROUTE}?name=${encodeURIComponent(name)}`
  return size === "full" ? url : `${url}&size=${size}`
}

export function placePhotoSize(value: string | null): PlacePhotoSize {
  return value === "thumb" ? "thumb" : "full"
}

// A page photo for a small thumbnail: a Google photo is fetched small, so
// the browser never shrinks a big one; the business's own photos stay.
export function thumbnailUrl(url: string): string {
  return url.startsWith(`${ROUTE}?`) && !url.includes("&size=")
    ? `${url}&size=thumb`
    : url
}
