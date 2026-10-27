"use server"

import { importPlace } from "@/features/place-import/api/import-place"
import { requireOwner } from "@/lib/dal"
import { claimBusinessForUser } from "@/features/dashboard/api/claim"

// Adds a business from a Google Maps link, then claims it for the owner.
// Importing a place that already exists only refreshes it.
export async function addBusinessFromLink(
  link: string
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; error: "invalid" | "not_found" | "owned" | "failed" }
> {
  const session = await requireOwner()
  const trimmed = link.trim()
  if (trimmed.length < 1 || trimmed.length > 2000) {
    return { ok: false, error: "invalid" }
  }
  let slug: string
  try {
    slug = await importPlace(trimmed)
  } catch (error) {
    if (error instanceof Error && error.message === "No business found") {
      return { ok: false, error: "not_found" }
    }
    return { ok: false, error: "failed" }
  }
  const claimed = await claimBusinessForUser(session.userId, slug)
  if (!claimed.ok) {
    return claimed
  }
  return claimed
}
