"use client"

import { useEffect } from "react"
import { CircleAlertIcon, InfoIcon } from "@/components/ui/icons"

import { Alert, AlertDescription } from "@/components/ui/alert"

// What went wrong with Google sign-in, from the `error` it came back with
// (better-auth.com/docs/concepts/users-accounts#account-linking).
// account_not_linked: the email already has a password account that was
// never verified, so Google is not joined to it (that keeps someone who
// signed up with another person's email out of their account). It is a
// tip, not a failure, so it shows in the calm style.
const TIPS: Record<string, string> = {
  account_not_linked:
    "You signed up with email and password. Log in that way below.",
}

// The owner pressed Cancel on Google's screen: nothing went wrong.
const SILENT = new Set(["access_denied"])

const FALLBACK = "Google sign-in didn't work. Try again."

export function GoogleError({ code }: { code: string }) {
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
    <Alert variant={tip ? "default" : "destructive"}>
      {tip ? <InfoIcon /> : <CircleAlertIcon />}
      <AlertDescription>{tip ?? FALLBACK}</AlertDescription>
    </Alert>
  )
}
