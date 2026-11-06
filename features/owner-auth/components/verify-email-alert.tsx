"use client"

import { useState } from "react"
import { MailIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { AFTER_LOGIN_PATH } from "@/lib/auth-links"

// Shown until a password account opens the link from its sign-up email
// (better-auth.com/docs/concepts/email#email-verification). Confirming lets
// Google sign-in join the same account later. Its words come from the page,
// in the owner's language.
export function VerifyEmailAlert({
  email,
  labels,
}: {
  email: string
  labels: {
    title: string
    sentTo: string
    resend: string
    sent: string
    failed: string
  }
}) {
  const [sending, setSending] = useState(false)

  const resend = async () => {
    setSending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: AFTER_LOGIN_PATH,
    })
    setSending(false)
    if (error) toast.error(labels.failed)
    else toast.success(labels.sent)
  }

  return (
    <Alert className="mb-6">
      <MailIcon />
      <AlertTitle>{labels.title}</AlertTitle>
      {/* A long address breaks onto the next line instead of pushing the
          page wider than a phone. */}
      <AlertDescription className="wrap-anywhere">
        {labels.sentTo}
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" onClick={resend} disabled={sending}>
          {sending && <Spinner data-icon="inline-start" />}
          {labels.resend}
        </Button>
      </AlertAction>
    </Alert>
  )
}
