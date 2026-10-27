"use client"

import { createContext, useContext } from "react"

import { messagesFor, type Messages } from "@/lib/i18n"
import { DEFAULT_LANGUAGE, type PageLanguage } from "@/lib/page-language"

const LanguageContext = createContext<PageLanguage>(DEFAULT_LANGUAGE)

// The public page's language, for its client parts (server parts are given
// `language` directly).
export function LanguageProvider({
  language,
  children,
}: {
  language: PageLanguage
  children: React.ReactNode
}) {
  return <LanguageContext value={language}>{children}</LanguageContext>
}

export function usePageLanguage(): PageLanguage {
  return useContext(LanguageContext)
}

export function useMessages(): Messages {
  return messagesFor(useContext(LanguageContext))
}
