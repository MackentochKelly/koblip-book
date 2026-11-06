"use client"

import { useEffect } from "react"

import type { PageLanguage } from "@/lib/page-language"
import { useOwnerLanguage } from "@/components/app-language"

// A link from a public page names its language (the home page's): it
// becomes the owner's pick on this device, so sign-up, log-in and the
// dashboard after them all keep it.
export function RememberOwnerLanguage({
  language,
}: {
  language: PageLanguage
}) {
  const [current, setLanguage] = useOwnerLanguage()
  useEffect(() => {
    if (language !== current) setLanguage(language)
  }, [language, current, setLanguage])
  return null
}
