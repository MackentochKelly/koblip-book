import "server-only"

import { cookies, headers } from "next/headers"

import {
  languageParam,
  OWNER_LANGUAGE_COOKIE,
  pickOwnerLanguage,
} from "@/lib/page-language"

// The owner area's language: the one a link from a public page names
// (`linked`, its ?lang=, so the login page keeps the home page's), else the
// one picked on this device, else the phone's (Accept-Language), else
// English.
export async function getOwnerLanguage(linked?: string | string[]) {
  const fromLink = languageParam(linked)
  if (fromLink) return fromLink
  return pickOwnerLanguage(
    (await cookies()).get(OWNER_LANGUAGE_COOKIE)?.value,
    (await headers()).get("accept-language")
  )
}
