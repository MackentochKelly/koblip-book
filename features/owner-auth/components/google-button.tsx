"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { GoogleMark, googleButtonClassName } from "@/components/google-mark"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { loginHref } from "@/lib/auth-links"
import type { PageLanguage } from "@/lib/page-language"

// "Continue with Google", in Google's look (GoogleMark). After Google, the
// browser comes back to `callbackURL`; when Google sign-in fails, to the
// login page with `?error=` (and the same `next` and language), which
// says what happened, or to `errorCallbackURL` when the screen has its own.
export function GoogleButton({
  callbackURL,
  language = "en",
  errorCallbackURL = loginHref({ next: callbackURL, language }),
  disabled = false,
}: {
  callbackURL: string
  errorCallbackURL?: string
  disabled?: boolean
  language?: PageLanguage
}) {
  const t = useTranslations("ownerAuth")
  const [sending, setSending] = useState(false)

  const start = async () => {
    setSending(true)
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL,
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
      {t("google")}
    </Button>
  )
}
