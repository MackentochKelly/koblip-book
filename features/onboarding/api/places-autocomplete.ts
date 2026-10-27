import "server-only"

const PLACES_API = "https://places.googleapis.com/v1"

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    throw new Error("GOOGLE_MAPS_PLATFORM_KEY is not set")
  }
  return key
}

export interface PlacePrediction {
  placeId: string
  mainText: string
  secondaryText: string | null
}

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
  }>
}

// One POST to Autocomplete (New). A non-200 answer throws with Google's
// error message; callers decide what the UI sees.
export async function autocomplete(
  body: Record<string, unknown>
): Promise<PlacePrediction[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  let res: Response
  try {
    res = await fetch(`${PLACES_API}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
      },
      body: JSON.stringify(body),
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
  const data = (await res.json()) as AutocompleteResponse
  const predictions: PlacePrediction[] = []
  for (const suggestion of data.suggestions ?? []) {
    const prediction = suggestion.placePrediction
    if (!prediction?.placeId) {
      continue
    }
    predictions.push({
      placeId: prediction.placeId,
      mainText: prediction.structuredFormat?.mainText?.text ?? "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text ?? null,
    })
  }
  return predictions
}
