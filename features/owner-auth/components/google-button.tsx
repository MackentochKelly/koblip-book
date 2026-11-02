"use client"

import { useState } from "react"

import { GoogleMark, googleButtonClassName } from "@/components/google-mark"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import type { PageLanguage } from "@/lib/page-language"
import { authWordsFor } from "../i18n"

// "Continue with Google", in Google's look (GoogleMark). After Google, the
// browser comes back to `callbackURL`; when Google sign-in fails, to the
// login page with `?error=` (and the same `next`), which says what
// happened.
export function GoogleButton({
  callbackURL,
  disabled = false,
  language = "en",
}: {
  callbackURL: string
  disabled?: boolean
  language?: PageLanguage
}) {
  const [sending, setSending] = useState(false)

  const start = async () => {
    setSending(true)
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: `/login?next=${encodeURIComponent(callbackURL)}`,
    })
    if (error) setSending(false)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => void start()}
      disabled={disabled || sending}
      className={googleButtonClassName}
    >
      {sending ? <Spinner data-icon="inline-start" /> : <GoogleMark />}
      {authWordsFor(language).google}
    </Button>
  )
}
