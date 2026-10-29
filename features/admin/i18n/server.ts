import "server-only"

import { headers } from "next/headers"
import { pickLanguage } from "@/lib/page-language"
import { adminMessagesFor } from "."

// The admin area speaks the device's language (Accept-Language), else
// English.
export async function getAdminLanguage() {
  return pickLanguage(undefined, (await headers()).get("accept-language"))
}

export async function getAdminMessages() {
  return adminMessagesFor(await getAdminLanguage())
}
