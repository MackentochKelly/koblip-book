"use server"

import { autocomplete } from "./places-autocomplete"
import type { BusinessSuggestion, CitySuggestion, Coordinates } from "../types"

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
  return trimmed.length >= 2 && trimmed.length <= 100
}

// Business search for the home page box. Never throws: a Google failure
// just shows no suggestions.
export async function searchBusinesses({
  input,
  sessionToken,
  near,
}: {
  input: string
  sessionToken: string
  near?: Coordinates
}): Promise<BusinessSuggestion[]> {
  if (!validInput(input) || !validSessionToken(sessionToken)) {
    return []
  }
  const body: Record<string, unknown> = {
    input: input.trim(),
    sessionToken,
    languageCode: "en",
  }
  if (validCoordinates(near)) {
    body.locationBias = {
      circle: {
        center: { latitude: near.latitude, longitude: near.longitude },
        radius: 50000.0,
      },
    }
  }
  try {
    const predictions = await autocomplete(body)
    return predictions.slice(0, 5).map((prediction) => ({
      placeId: prediction.placeId,
      name: prediction.mainText,
      address: prediction.secondaryText,
    }))
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
    return predictions.slice(0, 5).map((prediction) => ({
      placeId: prediction.placeId,
      name: prediction.mainText,
      region: prediction.secondaryText,
    }))
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
