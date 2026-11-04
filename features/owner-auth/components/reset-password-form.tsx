"use client"

import Link from "next/link"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { CircleAlertIcon, InfoIcon } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type { PageLanguage } from "@/lib/page-language"
import { authWordsFor } from "../i18n"
import { authError, type AuthError } from "../utils/auth-error"

// One new password, from the link in the "Forgot password" email. Its end
// states, a changed password or a dead link, each lead back to log in.
export function ResetPasswordForm({
  token,
  next,
  language,
}: {
  // Null when the link came back without one: it is old or used.
  token: string | null
  next: string
  language: PageLanguage
}) {
  const t = authWordsFor(language)
  const [password, setPassword] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [ended, setEnded] = useState<"changed" | "expired" | null>(
    token ? null : "expired"
  )

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending || !token) return
    if (password.length < ONBOARDING_RULES.minPasswordLength) {
      setError({ field: "password", message: "password" })
      return
    }
    setError(null)
    setSending(true)
    // Null when the server could not be reached.
    const result = await authClient
      .resetPassword({ newPassword: password, token })
      .catch(() => null)
    setSending(false)
    if (result && !result.error) {
      setEnded("changed")
      return
    }
    if (result?.error?.code === "INVALID_TOKEN") {
      setEnded("expired")
      return
    }
    setError(authError(result?.error ?? null, "password"))
  }

  if (ended) {
    return (
      <FieldGroup>
        <Alert>
          <InfoIcon />
          <AlertDescription>
            {ended === "changed" ? t.passwordChanged : t.linkExpired}
          </AlertDescription>
        </Alert>
        <Button
          size="lg"
          nativeButton={false}
          render={
            <Link
              href={`/login?${new URLSearchParams({ next, lang: language })}`}
            />
          }
        >
          {ended === "changed" ? t.logIn : t.backToLogIn}
        </Button>
      </FieldGroup>
    )
  }

  const passwordError = error?.field === "password"
  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup>
        <Field data-invalid={passwordError || undefined}>
          <FieldLabel htmlFor="new-password">{t.password}</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={sending}
            aria-invalid={passwordError || undefined}
            aria-describedby={passwordError ? "new-password-error" : undefined}
          />
          {passwordError && (
            <FieldError id="new-password-error">
              {t.errors[error.message]}
            </FieldError>
          )}
        </Field>
        {error && !passwordError && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{t.errors[error.message]}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" disabled={sending}>
          {sending && <Spinner data-icon="inline-start" />}
          {t.savePassword}
        </Button>
      </FieldGroup>
    </form>
  )
}
