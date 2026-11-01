import "server-only"

import { placesPost } from "./places-request"

// A place (business, address, city…) or, with includeQueryPredictions, a
// search Google suggests for the words ("photography studio near
// Brockton, MA, USA"), to run with Text Search.
export type PlacePrediction =
  | {
      kind: "place"
      placeId: string
      mainText: string
      secondaryText: string | null
    }
  | { kind: "query"; text: string }

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
    queryPrediction?: {
      text?: { text?: string }
    }
  }>
}

// One POST to Autocomplete (New), in Google's order. A non-200 answer
// throws with Google's error message; callers decide what the UI sees.
export async function autocomplete(
  body: Record<string, unknown>
): Promise<PlacePrediction[]> {
  const data = await placesPost<AutocompleteResponse>(
    "places:autocomplete",
    body
  )
  const predictions: PlacePrediction[] = []
  for (const suggestion of data.suggestions ?? []) {
    const place = suggestion.placePrediction
    if (place?.placeId) {
      predictions.push({
        kind: "place",
        placeId: place.placeId,
        mainText: place.structuredFormat?.mainText?.text ?? "",
        secondaryText: place.structuredFormat?.secondaryText?.text ?? null,
      })
      continue
    }
    const text = suggestion.queryPrediction?.text?.text?.trim()
    if (text) {
      predictions.push({ kind: "query", text })
    }
  }
  return predictions
}
