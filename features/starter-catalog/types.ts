// What Meta AI writes for a new business, in the business's own currency's
// main unit (25 = 25.00). Checked by utils/check-catalog before saving.
export interface DraftItem {
  name: string
  description: string
  durationMinutes: number
  price: number
}

// A service also names its kind in 1 to 3 words, like "Haircuts".
// Optional: a draft is never sent back for it.
export interface DraftService extends DraftItem {
  category?: string
}

export interface DraftCatalog {
  services: DraftService[]
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
  // True while setup is unfinished and the catalog is saved: the rows
  // still run after a server restart. Existing services and team stay.
  created: boolean
}

export type StarterResult =
  | { ok: true; summary: StarterSummary }
  | { ok: false; error: "not_found" | "ai_off" | "failed" }
