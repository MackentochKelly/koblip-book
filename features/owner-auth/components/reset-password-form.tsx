"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { loginHref } from "@/lib/auth-links"
import type { PageLanguage } from "@/lib/page-language"
import { useAuthErrorText } from "../hooks/use-auth-error-text"
import {
  authError,
  passwordProblem,
  type AuthError,
} from "../utils/auth-error"
import { AuthNotice } from "./auth-notice"
import { AuthSubmit } from "./auth-submit"
import { PasswordField } from "./password-field"

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
  // The page's, for the way back to log in.
  language: PageLanguage
}) {
  const t = useTranslations("ownerAuth")
  const errorText = useAuthErrorText()
  const [password, setPassword] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [ended, setEnded] = useState<"changed" | "expired" | null>(
    token ? null : "expired"
  )

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending || !token) return
    const problem = passwordProblem(password)
    setError(problem)
    if (problem) return
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
        <AuthNotice kind="info">
          {ended === "changed" ? t("passwordChanged") : t("linkExpired")}
        </AuthNotice>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={loginHref({ next, language })} />}
        >
          {ended === "changed" ? t("logIn") : t("backToLogIn")}
        </Button>
      </FieldGroup>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup>
        <PasswordField
          id="new-password"
          label={t("password")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          autoFocus
          disabled={sending}
          error={error?.field === "password" ? errorText(error.message) : null}
        />
        {error && error.field !== "password" && (
          <AuthNotice kind="error">{errorText(error.message)}</AuthNotice>
        )}
        <AuthSubmit busy={sending}>{t("savePassword")}</AuthSubmit>
      </FieldGroup>
    </form>
  )
}
