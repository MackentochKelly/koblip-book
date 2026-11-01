// What Meta AI writes for a new business, in the business's own currency's
// main unit (25 = 25.00). Checked by utils/check-catalog before saving.
export interface DraftItem {
  name: string
  description: string
  durationMinutes: number
  price: number
}

export interface DraftCatalog {
  services: DraftItem[]
  extras: {
    // The group's short name in the dashboard: "Add-ons".
    name: string
    // The question over the extras on the booking page.
    prompt: string
    options: DraftItem[]
  }
  team: {
    // One person's job, singular: "Barber".
    role: string
    members: Array<{
      name: string
      description: string
    }>
  }
}

// What the preparing screen shows, row by row.
export interface StarterSummary {
  currency: string
  services: Array<{ name: string; priceMinor: number | null }>
  extras: string[]
  team: Array<{ id: string; name: string; photoUrl: string | null }>
  role: string | null
  // True when this run wrote the catalog; false when the business already
  // had services or team (nothing is changed then).
  created: boolean
}

export type StarterResult =
  | { ok: true; summary: StarterSummary }
  | { ok: false; error: "not_found" | "ai_off" | "failed" }
