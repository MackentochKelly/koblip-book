import "server-only"

import { cookies, headers } from "next/headers"

import { ownerMessagesFor } from "."
import {
  isPageLanguage,
  languageParam,
  OWNER_LANGUAGE_COOKIE,
  pickLanguage,
  pickLocale,
} from "@/lib/page-language"

// The owner area's language: the one a link from a public page names
// (`linked`, its ?lang=, so the login page keeps the home page's), else the
// one picked on this device, else the phone's (Accept-Language), else
// English.
export async function getOwnerLanguage(linked?: string | string[]) {
  const fromLink = languageParam(linked)
  if (fromLink) return fromLink
  const picked = (await cookies()).get(OWNER_LANGUAGE_COOKIE)?.value
  if (isPageLanguage(picked)) return picked
  return pickLanguage(undefined, (await headers()).get("accept-language"))
}

// How numbers, prices and dates read: that language in the owner's own
// region, from the browser (es-ES: "1234 €").
export async function getOwnerLocale() {
  return pickLocale(
    await getOwnerLanguage(),
    (await headers()).get("accept-language")
  )
}

export async function getOwnerMessages() {
  const [language, locale] = await Promise.all([
    getOwnerLanguage(),
    getOwnerLocale(),
  ])
  return { ...ownerMessagesFor(language), locale }
}
