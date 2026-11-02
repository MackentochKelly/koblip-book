export interface BusinessSuggestion {
  placeId: string
  name: string
  address: string | null
}

// One row of the business search, in Google's order: a business, or a
// search Google suggests ("photography studio near Brockton, MA, USA")
// that lists businesses when tapped.
export type BusinessSearchResult =
  ({ kind: "business" } & BusinessSuggestion) | { kind: "query"; text: string }

export interface CitySuggestion {
  placeId: string
  name: string
  region: string | null
}

export interface Coordinates {
  latitude: number
  longitude: number
}

export type PreparedBusiness =
  | {
      ok: true
      slug: string
      name: string
      address: string | null
      photoUrl: string | null
      category: string | null
      phone: string | null
      website: string | null
      openDays: number
    }
  | { ok: false; error: "invalid" | "not_found" | "failed" }

// A business the owner picked, before its page is ready: a search result
// (its Google place, with the search's session token) or a pasted link's
// page, already saved.
export type FoundBusiness = { name: string; address: string | null } & (
  { placeId: string; sessionToken: string } | { slug: string }
)
