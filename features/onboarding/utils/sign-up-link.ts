import type { FoundBusiness } from "../types"

// The sign-up page: /login carrying the picked business, so the home page
// can hand the owner over to it and the page can start building theirs.
const SIGN_UP_PATH = "/login"

const PARAMS = {
  name: "name",
  address: "address",
  placeId: "place",
  sessionToken: "token",
  slug: "business",
} as const

// Long enough for any real name or address, short enough for a link.
const MAX_TEXT = 300

export function signUpHref(found: FoundBusiness): string {
  const params = new URLSearchParams({ [PARAMS.name]: found.name })
  if (found.address) params.set(PARAMS.address, found.address)
  if ("slug" in found) {
    params.set(PARAMS.slug, found.slug)
  } else {
    params.set(PARAMS.placeId, found.placeId)
    params.set(PARAMS.sessionToken, found.sessionToken)
  }
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
// place id and slug are checked again where they are used.
export function readSignUpLink(params: SearchParams): FoundBusiness | null {
  const name = text(params, PARAMS.name)
  if (!name) return null
  const address = text(params, PARAMS.address) || null
  const slug = text(params, PARAMS.slug)
  if (slug) return { name, address, slug }
  const placeId = text(params, PARAMS.placeId)
  const sessionToken = text(params, PARAMS.sessionToken)
  if (placeId && sessionToken) return { name, address, placeId, sessionToken }
  return null
}
