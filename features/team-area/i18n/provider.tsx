"use client"

import { createContext, use } from "react"

import type { PageLanguage } from "@/lib/page-language"
import { teamAreaWordsFor } from "."

const LanguageContext = createContext<{ language: PageLanguage; locale: string }>({
  language: "en",
  locale: "en-US",
})

// The team area's language and locale, picked on the server (see ./server).
export function TeamAreaLanguageProvider({
  language,
  locale,
  children,
}: {
  language: PageLanguage
  locale: string
  children: React.ReactNode
}) {
  return <LanguageContext value={{ language, locale }}>{children}</LanguageContext>
}

export function useTeamAreaWords() {
  const { language, locale } = use(LanguageContext)
  return { ...teamAreaWordsFor(language), locale }
}
