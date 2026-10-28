import "server-only"

import { cookies, headers } from "next/headers"

import { ownerMessagesFor } from "."
import { OWNER_LANGUAGE_COOKIE } from "./language"
import { isPageLanguage, pickLanguage } from "@/lib/page-language"

// The owner area's language: the one picked on this device, else the
// phone's (Accept-Language), else English.
export async function getOwnerLanguage() {
  const picked = (await cookies()).get(OWNER_LANGUAGE_COOKIE)?.value
  if (isPageLanguage(picked)) return picked
  return pickLanguage(undefined, (await headers()).get("accept-language"))
}

export async function getOwnerMessages() {
  return ownerMessagesFor(await getOwnerLanguage())
}
