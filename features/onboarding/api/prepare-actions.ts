"use server"

import { eq } from "drizzle-orm"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import {
  importPlace,
  importPlaceById,
} from "@/features/place-import/api/import-place"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import type { PreparedBusiness } from "../types"
import { purgeUnclaimedImports } from "./purge-unclaimed"

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

function failed(error: unknown): PreparedBusiness {
  console.error(error instanceof Error ? error.message : String(error))
  return { ok: false, error: "failed" }
}

// Reads the freshly imported business row plus its first photo.
async function toPrepared(slug: string): Promise<PreparedBusiness> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) {
    return failed("prepareBusiness imported no business row")
  }
  const page = await getBusinessPage(slug)
  return {
    ok: true,
    slug,
    name: business.name,
    address: business.address,
    photoUrl: page?.photos[0]?.url ?? null,
  }
}

// Imports the picked place (creating or refreshing the business row, no
// login needed) and returns what the login page shows for it.
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
  return toPrepared(slug)
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
  return toPrepared(slug)
}
