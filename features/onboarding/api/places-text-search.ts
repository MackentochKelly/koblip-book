import "server-only"

import { placesPost } from "./places-request"

export interface TextSearchPlace {
  placeId: string
  name: string
  address: string | null
}

interface TextSearchResponse {
  places?: Array<{
    id?: string
    displayName?: { text?: string }
    formattedAddress?: string
  }>
}

// Only what a result row shows: Text Search (New) bills by these fields
// (id, name and address are its Pro fields).
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress"

// One POST to Text Search (New): businesses for a phrase like "photography
// studio near Brockton, MA, USA", which Autocomplete can't match by name.
export async function textSearch(
  body: Record<string, unknown>
): Promise<TextSearchPlace[]> {
  const data = await placesPost<TextSearchResponse>(
    "places:searchText",
    body,
    FIELD_MASK
  )
  const places: TextSearchPlace[] = []
  for (const place of data.places ?? []) {
    const name = place.displayName?.text?.trim()
    if (!place.id || !name) continue
    places.push({
      placeId: place.id,
      name,
      address: place.formattedAddress ?? null,
    })
  }
  return places
}
