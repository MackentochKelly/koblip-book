"use client"

import { useState } from "react"
import { MailIcon } from "lucide-react"
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

// Shown until a password account opens the link from its sign-up email
// (better-auth.com/docs/concepts/email#email-verification). Confirming lets
// Google sign-in join the same account later.
export function VerifyEmailAlert({ email }: { email: string }) {
  const [sending, setSending] = useState(false)

  const resend = async () => {
    setSending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    })
    setSending(false)
    if (error) toast.error("Could not send. Try again.")
    else toast.success("Email sent")
  }

  return (
    <Alert className="mb-6">
      <MailIcon />
      <AlertTitle>Confirm your email</AlertTitle>
      <AlertDescription>We sent a link to {email}.</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={resend} disabled={sending}>
          {sending && <Spinner data-icon="inline-start" />}
          Resend
        </Button>
      </AlertAction>
    </Alert>
  )
}
