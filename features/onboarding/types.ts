export interface BusinessSuggestion {
  placeId: string
  name: string
  address: string | null
}

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
