"use server"

import {
  importPlace,
  importPlaceById,
} from "@/features/place-import/api/import-place"
import type { PreparedBusiness } from "../types"
import { failed, readPreparedBusiness } from "./prepared-business"
import { purgeUnclaimedImports } from "./purge-unclaimed"

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

// Imports the picked place (a new business row, or the one already saved,
// left as it is; no login needed) and returns what the login page shows
// for it.
export async function prepareBusiness({
  placeId,
  sessionToken,
}: {
  placeId: string
  sessionToken?: string
}): Promise<PreparedBusiness> {
  if (
    !placeId ||
    typeof placeId !== "string" ||
    !PLACE_ID_PATTERN.test(placeId)
  ) {
    return { ok: false, error: "invalid" }
  }
  await purgeUnclaimedImports()
  let slug: string
  try {
    slug = await importPlaceById(placeId, sessionToken)
  } catch (error) {
    if (error instanceof Error && error.message === "No business found") {
      return { ok: false, error: "not_found" }
    }
    return failed(error)
  }
  return readPreparedBusiness(slug)
}

// Same from a pasted Google Maps link. Replaces addBusinessFromLink.
export async function prepareBusinessFromLink({
  link,
}: {
  link: string
}): Promise<PreparedBusiness> {
  if (typeof link !== "string") {
    return { ok: false, error: "invalid" }
  }
  const trimmed = link.trim()
  if (trimmed.length < 1 || trimmed.length > 2000) {
    return { ok: false, error: "invalid" }
  }
  await purgeUnclaimedImports()
  let slug: string
  try {
    slug = await importPlace(trimmed)
  } catch (error) {
    if (error instanceof Error && error.message === "No business found") {
      return { ok: false, error: "not_found" }
    }
    return failed(error)
  }
  return readPreparedBusiness(slug)
}
