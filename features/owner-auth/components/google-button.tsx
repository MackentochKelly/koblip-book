"use client"

import { useState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

// "Continue with Google", drawn the way Google's branding rules ask
// (developers.google.com/identity/branding-guidelines): Google's own "G"
// from its sign-in pack, unchanged, on Google's light or dark button
// colours. After Google, the browser comes back to `callbackURL`; when
// Google sign-in fails, to the login page with `?error=` (and the same
// `next`), which says what happened.
export function GoogleButton({
  callbackURL,
  disabled = false,
}: {
  callbackURL: string
  disabled?: boolean
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
      className="border-google-button-border bg-google-button text-google-button-foreground hover:bg-google-button hover:text-google-button-foreground dark:border-google-button-border dark:bg-google-button dark:hover:bg-google-button"
    >
      {sending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <>
          <Image
            src="/brands/google-g-light.png"
            alt=""
            width={20}
            height={20}
            unoptimized
            data-icon="inline-start"
            className="dark:hidden"
          />
          <Image
            src="/brands/google-g-dark.png"
            alt=""
            width={20}
            height={20}
            unoptimized
            data-icon="inline-start"
            className="hidden dark:block"
          />
        </>
      )}
      Continue with Google
    </Button>
  )
}
