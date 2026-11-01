import "server-only"

import { headers } from "next/headers"
import {
  DEFAULT_LANGUAGE,
  isPageLanguage,
  PAGE_LANGUAGE_HEADER,
  pickLocale,
} from "@/lib/page-language"

// The team area speaks the language proxy.ts picked for the page (the one
// picked on this device, else the phone's), like the owner area.
export async function getTeamAreaLanguage() {
  const picked = (await headers()).get(PAGE_LANGUAGE_HEADER)
  return isPageLanguage(picked) ? picked : DEFAULT_LANGUAGE
}

// How dates and times read: that language in the person's own region.
export async function getTeamAreaLocale() {
  return pickLocale(
    await getTeamAreaLanguage(),
    (await headers()).get("accept-language")
  )
}
