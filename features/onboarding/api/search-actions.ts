"use server"

import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { autocomplete } from "./places-autocomplete"
import { textSearch } from "./places-text-search"
import type {
  BusinessSearchResult,
  BusinessSuggestion,
  CitySuggestion,
  Coordinates,
} from "../types"

const PLACES_API = "https://places.googleapis.com/v1"

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

function validSessionToken(token: unknown): token is string {
  return typeof token === "string" && SESSION_TOKEN_PATTERN.test(token)
}

function validCoordinates(near: unknown): near is Coordinates {
  if (!near || typeof near !== "object") {
    return false
  }
  const { latitude, longitude } = near as {
    latitude?: unknown
    longitude?: unknown
  }
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function validInput(input: unknown): input is string {
  if (typeof input !== "string") {
    return false
  }
  const trimmed = input.trim()
  return (
    trimmed.length >= ONBOARDING_RULES.minInput &&
    trimmed.length <= ONBOARDING_RULES.maxInput
  )
}

function locationBias(near: unknown) {
  if (!validCoordinates(near)) {
    return {}
  }
  return {
    locationBias: {
      circle: {
        center: { latitude: near.latitude, longitude: near.longitude },
        radius: ONBOARDING_RULES.biasRadiusMeters,
      },
    },
  }
}

// Business search for the home page box. Autocomplete matches business
// names; for words like "photography studio Brockton" it also suggests
// searches ("… near Brockton, MA, USA"), which searchBusinessesByText
// runs when tapped (Google's documented pairing, so Text Search is billed
// only on a tap). Never throws: a Google failure just shows no suggestions.
export async function searchBusinesses({
  input,
  sessionToken,
  near,
}: {
  input: string
  sessionToken: string
  near?: Coordinates
}): Promise<BusinessSearchResult[]> {
  if (!validInput(input) || !validSessionToken(sessionToken)) {
    return []
  }
  try {
    const predictions = await autocomplete({
      input: input.trim(),
      sessionToken,
      languageCode: "en",
      includeQueryPredictions: true,
      ...locationBias(near),
    })
    return predictions
      .slice(0, ONBOARDING_RULES.maxResults)
      .map((prediction): BusinessSearchResult =>
        prediction.kind === "query"
          ? { kind: "query", text: prediction.text }
          : {
              kind: "business",
              placeId: prediction.placeId,
              name: prediction.mainText,
              address: prediction.secondaryText,
            }
      )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return []
  }
}

// The businesses for a search Autocomplete suggested. One Text Search
// call per tap. Never throws: a Google failure just shows no businesses.
export async function searchBusinessesByText({
  text,
  near,
}: {
  text: string
  near?: Coordinates
}): Promise<BusinessSuggestion[]> {
  if (!validInput(text)) {
    return []
  }
  try {
    return await textSearch({
      textQuery: text.trim(),
      languageCode: "en",
      pageSize: ONBOARDING_RULES.maxResults,
      ...locationBias(near),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return []
  }
}

// City search for the "near" picker. Same rules, no location bias.
export async function searchCities({
  input,
  sessionToken,
}: {
  input: string
  sessionToken: string
}): Promise<CitySuggestion[]> {
  if (!validInput(input) || !validSessionToken(sessionToken)) {
    return []
  }
  try {
    const predictions = await autocomplete({
      input: input.trim(),
      sessionToken,
      languageCode: "en",
      includedPrimaryTypes: ["(cities)"],
    })
    return predictions
      .flatMap((prediction) =>
        prediction.kind === "place"
          ? [
              {
                placeId: prediction.placeId,
                name: prediction.mainText,
                region: prediction.secondaryText,
              },
            ]
          : []
      )
      .slice(0, ONBOARDING_RULES.maxResults)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return []
  }
}

// Where a picked city is, so business search can bias around it. The
// session token ends the autocomplete session. Null on any error.
export async function cityCenter({
  placeId,
  sessionToken,
}: {
  placeId: string
  sessionToken: string
}): Promise<Coordinates | null> {
  if (
    typeof placeId !== "string" ||
    !PLACE_ID_PATTERN.test(placeId) ||
    !validSessionToken(sessionToken)
  ) {
    return null
  }
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    return null
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(
      `${PLACES_API}/places/${placeId}?languageCode=en&sessionToken=${sessionToken}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "location",
        },
        signal: controller.signal,
      }
    )
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as {
      location?: { latitude?: unknown; longitude?: unknown }
    }
    const { latitude, longitude } = data.location ?? {}
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null
    }
    return { latitude, longitude }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
