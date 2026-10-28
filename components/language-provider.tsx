"use client"

import { createContext, useContext, useEffect } from "react"

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
  // A language switch on the page doesn't reload the layout, so <html lang>
  // follows here too (as in the owner area).
  useEffect(() => {
    const before = document.documentElement.lang
    document.documentElement.lang = language
    return () => {
      document.documentElement.lang = before
    }
  }, [language])
  return <LanguageContext value={language}>{children}</LanguageContext>
}

export function usePageLanguage(): PageLanguage {
  return useContext(LanguageContext)
}

export function useMessages(): Messages {
  return messagesFor(useContext(LanguageContext))
}
