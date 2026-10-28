"use client"

import { createContext, use, useEffect } from "react"
import { useRouter } from "next/navigation"

import type { PageLanguage } from "@/lib/page-language"
import { ownerMessagesFor } from "."
import { OWNER_LANGUAGE_COOKIE, OWNER_LANGUAGE_MAX_AGE } from "./language"

const LanguageContext = createContext<PageLanguage>("en")

// The owner area's language, picked on the server (see ./server),
// so the first paint is already in it.
export function OwnerLanguageProvider({
  language,
  children,
}: {
  language: PageLanguage
  children: React.ReactNode
}) {
  useEffect(() => {
    const before = document.documentElement.lang
    document.documentElement.lang = language
    return () => {
      document.documentElement.lang = before
    }
  }, [language])
  return <LanguageContext value={language}>{children}</LanguageContext>
}

export function useOwnerMessages() {
  return ownerMessagesFor(use(LanguageContext))
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
