import "server-only"

const PLACES_API = "https://places.googleapis.com/v1"

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    throw new Error("GOOGLE_MAPS_PLATFORM_KEY is not set")
  }
  return key
}

interface SearchResponse {
  places?: Array<{ id: string }>
}

async function searchText(
  body: Record<string, unknown>
): Promise<SearchResponse> {
  const res = await fetch(`${PLACES_API}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `Google Places request failed with status ${res.status}`
    try {
      const errorBody = (await res.json()) as {
        error?: { message?: string }
      }
      if (errorBody?.error?.message) {
        message = errorBody.error.message
      }
    } catch {
      // Keep the default message.
    }
    throw new Error(message)
  }
  return (await res.json()) as SearchResponse
}

function isMapsLink(input: string): boolean {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return false
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false
  }
  const host = url.hostname.toLowerCase()
  return (
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host.endsWith(".goo.gl") ||
    host.includes("google.") ||
    url.pathname.includes("/maps")
  )
}

// A shared Maps URL carries the place ID directly.
function placeIdFromUrl(finalUrl: string): string | null {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return null
  }
  const fromParam = url.searchParams.get("query_place_id")
  if (fromParam) {
    return fromParam
  }
  const match = /place_id:([^/?&#]+)/.exec(finalUrl)
  return match ? match[1] : null
}

// Otherwise the URL carries the place name (/maps/place/<name>/) and the
// coordinates (@<lat>,<lng>), which locate one Text Search result.
function nameAndCoordsFromUrl(
  finalUrl: string
): { name: string; latitude: number; longitude: number } | null {
  const placeMatch = /\/maps\/place\/([^/?#]+)/.exec(finalUrl)
  const coordsMatch = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(finalUrl)
  if (!placeMatch || !coordsMatch) {
    return null
  }
  const latitude = Number(coordsMatch[1])
  const longitude = Number(coordsMatch[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return {
    name: decodeURIComponent(placeMatch[1].replace(/\+/g, " ")),
    latitude,
    longitude,
  }
}

// Turns what the owner pasted (a Google Maps link or any other text) into a
// Google place ID. Throws "No business found" when nothing matches.
export async function findPlaceId(input: string): Promise<string> {
  if (isMapsLink(input)) {
    // Short links redirect to the full Maps URL; fetch follows them.
    const res = await fetch(input, { redirect: "follow" })
    try {
      await res.body?.cancel()
    } catch {
      // The final URL is all we need.
    }
    const direct = placeIdFromUrl(res.url)
    if (direct) {
      return direct
    }
    const named = nameAndCoordsFromUrl(res.url)
    if (!named) {
      throw new Error("No business found")
    }
    const matches = await searchText({
      textQuery: named.name,
      pageSize: 1,
      languageCode: "en",
      locationBias: {
        circle: {
          center: { latitude: named.latitude, longitude: named.longitude },
          radius: 500.0,
        },
      },
    })
    const id = matches.places?.[0]?.id
    if (!id) {
      throw new Error("No business found")
    }
    return id
  }

  const matches = await searchText({
    textQuery: input,
    pageSize: 1,
    languageCode: "en",
  })
  const id = matches.places?.[0]?.id
  if (!id) {
    throw new Error("No business found")
  }
  return id
}
