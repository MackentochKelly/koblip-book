import "server-only"

import type { FoundBusiness, PreparedBusiness } from "../types"
import { prepareBusiness } from "./prepare-actions"
import { failed, readPreparedBusiness } from "./prepared-business"

// Same rule as the slugs the place importer makes.
const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/

// The sign-up page's business, built on the server while the page is
// already showing: a search result is imported, a pasted link's page is
// read back.
export async function prepareFound(
  found: FoundBusiness
): Promise<PreparedBusiness> {
  if ("slug" in found) {
    if (!SLUG_PATTERN.test(found.slug)) return { ok: false, error: "invalid" }
    return readPreparedBusiness(found.slug).catch(failed)
  }
  return prepareBusiness({
    placeId: found.placeId,
    sessionToken: found.sessionToken,
  }).catch(failed)
}
