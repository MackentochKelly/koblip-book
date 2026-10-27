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

// What a resolved Maps URL tells us, in order: a direct place ID, a
// name to Text Search (biased around coordinates when the URL has them),
// or nothing usable.
export type PlaceQueryFromUrl =
  | { kind: "placeId"; placeId: string }
  | { kind: "text"; text: string; latitude?: number; longitude?: number }
  | null

function placeNameFromUrl(finalUrl: string): string | null {
  const placeMatch = /\/maps\/place\/([^/?#]+)/.exec(finalUrl)
  if (!placeMatch) {
    return null
  }
  const name = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim()
  return name.length > 0 ? name : null
}

function coordsFromUrl(
  finalUrl: string
): { latitude: number; longitude: number } | null {
  const coordsMatch =
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(finalUrl) ??
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(finalUrl)
  if (!coordsMatch) {
    return null
  }
  const latitude = Number(coordsMatch[1])
  const longitude = Number(coordsMatch[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return { latitude, longitude }
}

// Pure: turns a resolved Maps URL into a place ID or a Text Search query.
export function placeQueryFromUrl(finalUrl: string): PlaceQueryFromUrl {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return null
  }
  // A consent interstitial carries the real URL in its continue param.
  if (url.hostname.toLowerCase() === "consent.google.com") {
    const continued = url.searchParams.get("continue")
    if (!continued) {
      return null
    }
    return placeQueryFromUrl(continued)
  }
  const fromParam = url.searchParams.get("query_place_id")
  if (fromParam) {
    return { kind: "placeId", placeId: fromParam }
  }
  const idMatch = /place_id:([^/?&#]+)/.exec(finalUrl)
  if (idMatch) {
    return { kind: "placeId", placeId: idMatch[1] }
  }
  const name = placeNameFromUrl(finalUrl)
  if (name) {
    const coords = coordsFromUrl(finalUrl)
    if (coords) {
      return { kind: "text", text: name, ...coords }
    }
  }
  const query = url.searchParams.get("q")?.trim()
  if (query) {
    return { kind: "text", text: query }
  }
  if (name) {
    return { kind: "text", text: name }
  }
  return null
}

const LINK_TIMEOUT_MS = 5_000
const MAX_LINK_HOPS = 5
const LINK_USER_AGENT = "Mozilla/5.0 (compatible; KoblipBook/1.0)"

// Follows a pasted Maps link by hand (short links redirect to the full
// Maps URL). Max 5 hops, 5 second timeout per hop. A consent interstitial
// is not fetched: its continue param is the next URL.
async function resolveLink(startUrl: string): Promise<string> {
  let current = startUrl
  for (let hop = 0; hop < MAX_LINK_HOPS; hop++) {
    let url: URL
    try {
      url = new URL(current)
    } catch {
      return current
    }
    if (url.hostname.toLowerCase() === "consent.google.com") {
      const continued = url.searchParams.get("continue")
      if (!continued) {
        return current
      }
      current = continued
      continue
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": LINK_USER_AGENT },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    const location = res.headers.get("Location")
    if (!location) {
      return current
    }
    current = new URL(location, current).toString()
  }
  return current
}

// Turns what the owner pasted (a Google Maps link or any other text) into a
// Google place ID. Throws "No business found" when nothing matches.
export async function findPlaceId(input: string): Promise<string> {
  if (isMapsLink(input)) {
    const finalUrl = await resolveLink(input)
    const query = placeQueryFromUrl(finalUrl)
    if (!query) {
      throw new Error("No business found")
    }
    if (query.kind === "placeId") {
      return query.placeId
    }
    const matches = await searchText({
      textQuery: query.text,
      pageSize: 1,
      languageCode: "en",
      ...(query.latitude !== undefined && query.longitude !== undefined
        ? {
            locationBias: {
              circle: {
                center: {
                  latitude: query.latitude,
                  longitude: query.longitude,
                },
                radius: 500.0,
              },
            },
          }
        : {}),
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
