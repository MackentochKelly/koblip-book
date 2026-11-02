import type { PageLanguage } from "@/lib/page-language"
import type { FoundBusiness } from "../types"

// The sign-up page: /login carrying the picked business, so the home page
// can hand the owner over to it and the page can start building theirs.
// Google sign-in comes back to it too (`finish`): the card then makes the
// business the owner's and opens its setup. It keeps the home page's
// language (?lang=).
const SIGN_UP_PATH = "/login"

const PARAMS = {
  name: "name",
  address: "address",
  placeId: "place",
  sessionToken: "token",
  slug: "business",
  finish: "finish",
  language: "lang",
} as const

// Long enough for any real name or address, short enough for a link.
const MAX_TEXT = 300

export function signUpHref(
  found: FoundBusiness,
  {
    finish = false,
    language,
  }: { finish?: boolean; language?: PageLanguage } = {}
): string {
  const params = new URLSearchParams({ [PARAMS.name]: found.name })
  if (found.address) params.set(PARAMS.address, found.address)
  if ("slug" in found) {
    params.set(PARAMS.slug, found.slug)
  } else {
    params.set(PARAMS.placeId, found.placeId)
    params.set(PARAMS.sessionToken, found.sessionToken)
  }
  if (finish) params.set(PARAMS.finish, "1")
  if (language) params.set(PARAMS.language, language)
  return `${SIGN_UP_PATH}?${params}`
}

type SearchParams = Record<string, string | string[] | undefined>

const text = (params: SearchParams, key: string) => {
  const value = params[key]
  return typeof value === "string" && value.length <= MAX_TEXT
    ? value.trim()
    : ""
}

// The business a sign-up link carries, or null for a plain /login. The
// place id and slug are checked again where they are used. `finish`: back
// from Google with a saved business, to be made the owner's.
export function readSignUpLink(
  params: SearchParams
): { found: FoundBusiness; finish: string | null } | null {
  const name = text(params, PARAMS.name)
  if (!name) return null
  const address = text(params, PARAMS.address) || null
  const slug = text(params, PARAMS.slug)
  if (slug) {
    return {
      found: { name, address, slug },
      finish: text(params, PARAMS.finish) === "1" ? slug : null,
    }
  }
  const placeId = text(params, PARAMS.placeId)
  const sessionToken = text(params, PARAMS.sessionToken)
  if (placeId && sessionToken) {
    return { found: { name, address, placeId, sessionToken }, finish: null }
  }
  return null
}
