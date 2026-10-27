import "server-only"

export interface GooglePlacePoint {
  day: number
  hour: number
  minute: number
}

export interface GooglePlacePeriod {
  open: GooglePlacePoint
  close?: GooglePlacePoint
}

export interface GooglePhotoAttribution {
  displayName: string
  uri?: string
  photoUri?: string
}

export interface GooglePlacePhoto {
  name: string
  widthPx?: number
  heightPx?: number
  authorAttributions?: GooglePhotoAttribution[]
}

export interface GooglePlace {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text: string }
  regularOpeningHours?: { periods?: GooglePlacePeriod[] }
  timeZone?: { id: string }
  location?: { latitude: number; longitude: number }
  googleMapsUri?: string
  businessStatus?: string
  editorialSummary?: { text: string }
  addressComponents?: Array<{ types: string[]; shortText?: string }>
  photos?: GooglePlacePhoto[]
}

const PLACES_API = "https://places.googleapis.com/v1"

const FIELD_MASK =
  "id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,rating,userRatingCount,primaryTypeDisplayName,regularOpeningHours,timeZone,location,googleMapsUri,businessStatus,editorialSummary,addressComponents"

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    throw new Error("GOOGLE_MAPS_PLATFORM_KEY is not set")
  }
  return key
}

// Place Details (New): GET /v1/places/{placeId}. A non-200 answer throws
// with Google's error message. The session token ends an autocomplete
// session started by the onboarding search.
export async function fetchPlace(
  placeId: string,
  sessionToken?: string
): Promise<GooglePlace> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let res: Response
  try {
    res = await fetch(
      `${PLACES_API}/places/${placeId}?languageCode=en${sessionToken ? `&sessionToken=${sessionToken}` : ""}`,
      {
      headers: {
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": FIELD_MASK,
      },
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Google Places request timed out")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    let message = `Google Places request failed with status ${res.status}`
    try {
      const body = (await res.json()) as {
        error?: { message?: string }
      }
      if (body?.error?.message) {
        message = body.error.message
      }
    } catch {
      // Keep the default message.
    }
    throw new Error(message)
  }
  return (await res.json()) as GooglePlace
}
