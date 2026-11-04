"use client"

import { useEffect } from "react"

import type { PageLanguage } from "@/lib/page-language"
import { authWordsFor, type AuthWords } from "../i18n"
import { AuthNotice } from "./auth-notice"

// What went wrong with Google sign-in, from the `error` it came back with
// (better-auth.com/docs/concepts/users-accounts#account-linking).
// account_not_linked: the email already has a password account that was
// never verified, so Google is not joined to it (that keeps someone who
// signed up with another person's email out of their account). It is a
// tip, not a failure, so it shows in the calm style.
const TIPS: Record<string, keyof AuthWords["googleErrors"]> = {
  account_not_linked: "accountNotLinked",
}

// The owner pressed Cancel on Google's screen: nothing went wrong.
const SILENT = new Set(["access_denied"])

export function GoogleError({
  code,
  language = "en",
}: {
  code: string
  language?: PageLanguage
}) {
  const t = authWordsFor(language).googleErrors
  const key = code.replaceAll(" ", "_")

  // Shown once: the error leaves the address, so a refresh doesn't bring it
  // back (nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete("error")
    url.searchParams.delete("error_description")
    window.history.replaceState(null, "", url)
  }, [])

  if (SILENT.has(key)) return null
  const tip = TIPS[key]
  return (
    <AuthNotice kind={tip ? "info" : "error"}>
      {tip ? t[tip] : t.fallback}
    </AuthNotice>
  )
}
