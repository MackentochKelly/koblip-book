"use client"

import { useEffect } from "react"

import type { PageLanguage } from "@/lib/page-language"

// A page whose language can change on the page (?lang=) keeps its layout,
// so <html lang> follows here too (as in the owner area). The words
// themselves come from WordsProvider (components/words-provider.tsx).
export function LanguageProvider({
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
  return children
}
