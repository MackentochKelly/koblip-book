"use client"

import { createContext, use, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

import {
  DEFAULT_LOCALES,
  OWNER_LANGUAGE_COOKIE,
  type PageLanguage,
} from "@/lib/page-language"
import { ownerMessagesFor } from "."
import { OWNER_LANGUAGE_MAX_AGE } from "./language"

const LanguageContext = createContext<PageLanguage>("en")
// How numbers, prices and dates read (see ./server getOwnerLocale).
const LocaleContext = createContext<string>(DEFAULT_LOCALES.en)

// The owner area's language, picked on the server (see ./server),
// so the first paint is already in it.
export function OwnerLanguageProvider({
  language,
  locale,
  children,
}: {
  language: PageLanguage
  locale: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const before = document.documentElement.lang
    document.documentElement.lang = language
    return () => {
      document.documentElement.lang = before
    }
  }, [language])
  return (
    <LanguageContext value={language}>
      <LocaleContext value={locale}>{children}</LocaleContext>
    </LanguageContext>
  )
}

export function useOwnerMessages() {
  const language = use(LanguageContext)
  const locale = use(LocaleContext)
  return useMemo(
    () => ({ ...ownerMessagesFor(language), locale }),
    [language, locale]
  )
}

// The language and a way to change it: remembered on this device, then the
// pages are drawn again in it.
export function useOwnerLanguage() {
  const language = use(LanguageContext)
  const router = useRouter()
  const setLanguage = (next: PageLanguage) => {
    document.cookie = `${OWNER_LANGUAGE_COOKIE}=${next}; path=/; max-age=${OWNER_LANGUAGE_MAX_AGE}; samesite=lax`
    router.refresh()
  }
  return [language, setLanguage] as const
}
