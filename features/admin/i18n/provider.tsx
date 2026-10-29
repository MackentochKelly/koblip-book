"use client"

import { createContext, use } from "react"

import type { PageLanguage } from "@/lib/page-language"
import { adminMessagesFor } from "."

const LanguageContext = createContext<PageLanguage>("en")

// The admin area's language, picked on the server (see ./server).
export function AdminLanguageProvider({
  language,
  children,
}: {
  language: PageLanguage
  children: React.ReactNode
}) {
  return <LanguageContext value={language}>{children}</LanguageContext>
}

export function useAdminMessages() {
  return adminMessagesFor(use(LanguageContext))
}
