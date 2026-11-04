"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { CircleAlertIcon, InfoIcon, MailIcon } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { LAYOUT_MOVE } from "@/lib/motion-tokens"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type { PageLanguage } from "@/lib/page-language"
import { emailStatus } from "../api/email-status"
import { authWordsFor } from "../i18n"
import { authError, type AuthError } from "../utils/auth-error"
import { GoogleButton } from "./google-button"
import { GoogleError } from "./google-error"
import { noAutofill } from "@/lib/no-autofill"

type Step = "email" | "password" | "create"

// Email first: an existing account asks for its password, a new email asks
// for a name and a new password. One form for both, no sign-up page.
// After it, `onSignedIn` runs, or the screen opens `next`. Google first:
// it leaves the page and comes back to `googleNext` (default `next`).
// `language` picks its words. `emailLater`: Google alone at first, the email
// form unfolds under it when asked for.
export function AuthForm({
  next = "/dashboard",
  googleNext = next,
  googleErrorNext,
  googleReady = true,
  googleError = null,
  onSignedIn,
  disabled = false,
  emailLater = false,
  language = "en",
}: {
  next?: string
  googleNext?: string
  // Where a failed Google sign-in comes back to (default: this login page).
  googleErrorNext?: string
  googleReady?: boolean
  // The `error` Google sign-in came back with, if any.
  googleError?: string | null
  onSignedIn?: () => Promise<void>
  disabled?: boolean
  emailLater?: boolean
  language?: PageLanguage
}) {
  const t = authWordsFor(language)
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const busy = sending || disabled
  const [emailOpen, setEmailOpen] = useState(!emailLater)

  const checkEmail = async () => {
    const status = await emailStatus(email).catch(() => null)
    if (!status?.ok) {
      setError(status ? { field: "email", message: "email" } : authError(null, "password"))
      return
    }
    setError(null)
    setStep(status.exists ? "password" : "create")
  }

  const logIn = async () => {
    if (step === "create" && !name.trim()) {
      setError({ field: "name", message: "name" })
      return
    }
    if (password.length < ONBOARDING_RULES.minPasswordLength) {
      setError({ field: "password", message: "password" })
      return
    }
    // Null when the server could not be reached.
    const result = await (
      step === "create"
        ? authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
            // The link in the sign-up email opens this page, signed in.
            callbackURL: next,
          })
        : authClient.signIn.email({ email: email.trim(), password })
    ).catch(() => null)
    if (!result || result.error) {
      const mapped = authError(result?.error ?? null, step === "create" ? "create" : "password")
      if (mapped.message === "existingAccount") {
        setStep("password")
        setPassword("")
      }
      setError(mapped)
      return
    }
    setError(null)
    if (onSignedIn) {
      await onSignedIn()
      return
    }
    router.replace(next)
    router.refresh()
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setSending(true)
    try {
      await (step === "email" ? checkEmail() : logIn())
    } finally {
      setSending(false)
    }
  }

  const changeEmail = () => {
    setStep("email")
    setPassword("")
    setError(null)
    setResetSent(false)
  }

  // Its link opens the new password page, and that page leads back here.
  const forgotPassword = async () => {
    if (busy) return
    setSending(true)
    // Null when the server could not be reached.
    const result = await authClient
      .requestPasswordReset({
        email: email.trim(),
        redirectTo: `/reset-password?${new URLSearchParams({ next, lang: language })}`,
      })
      .catch(() => null)
    setSending(false)
    const failed = !result || result.error
    setError(failed ? authError(result?.error ?? null, "password") : null)
    setResetSent(!failed)
  }

  const emailPart = (
    <>
        <Field data-invalid={error?.field === "email" || undefined}>
          <FieldLabel htmlFor="auth-email">{t.email}</FieldLabel>
          {/* The account's username: password managers fill it with the
              saved password, so it keeps autofill (not noAutofill). */}
          <Input
            id="auth-email"
            aria-describedby={error?.field === "email" ? "auth-email-error" : undefined}
            name="email"
            autoComplete="username"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={step !== "email"}
            disabled={busy}
            // Just asked for: the owner types straight away.
            autoFocus={emailLater}
            aria-invalid={error?.field === "email" || undefined}
          />
          {error?.field === "email" && <FieldError id="auth-email-error">{t.errors[error.message]}</FieldError>}
        </Field>
        {step === "create" && (
          <Field data-invalid={error?.field === "name" || undefined}>
            <FieldLabel htmlFor="auth-name">{t.yourName}</FieldLabel>
            <Input
              {...noAutofill("auth_name")}
              id="auth-name"
              aria-invalid={error?.field === "name" || undefined}
              aria-describedby={error?.field === "name" ? "auth-name-error" : undefined}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              autoFocus
            />
            {error?.field === "name" && <FieldError id="auth-name-error">{t.errors[error.message]}</FieldError>}
          </Field>
        )}
        {step !== "email" && (
          <Field data-invalid={error?.field === "password" || undefined}>
            <FieldLabel htmlFor="auth-password">
              {step === "create" ? t.choosePassword : t.password}
            </FieldLabel>
            <Input
              id="auth-password"
              aria-describedby={error?.field === "password" ? "auth-password-error" : undefined}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                step === "create" ? "new-password" : "current-password"
              }
              disabled={busy}
              autoFocus={step === "password"}
              aria-invalid={error?.field === "password" || undefined}
            />
            {error?.field === "password" && <FieldError id="auth-password-error">{t.errors[error.message]}</FieldError>}
            {step === "password" && (
              <FieldDescription>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="dark:text-foreground"
                  disabled={busy}
                  onClick={() => void forgotPassword()}
                >
                  {t.forgotPassword}
                </Button>
              </FieldDescription>
            )}
          </Field>
        )}
        {resetSent && (
          <Alert>
            <MailIcon />
            <AlertDescription>{t.resetSent}</AlertDescription>
          </Alert>
        )}
        {error?.field === "form" && (
          <Alert variant={error.message === "existingAccount" ? "default" : "destructive"}>
            {error.message === "existingAccount" ? <InfoIcon /> : <CircleAlertIcon />}
            <AlertDescription>{t.errors[error.message]}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {step === "email"
            ? t.continue
            : step === "create"
              ? t.createAccount
              : t.logIn}
        </Button>
        {step !== "email" && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="dark:text-foreground"
            disabled={busy}
            onClick={changeEmail}
          >
            {t.useAnotherEmail}
          </Button>
        )}
    </>
  )

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup>
        {step === "email" && (
          <>
            {googleError && <GoogleError code={googleError} language={language} />}
            <GoogleButton
              callbackURL={googleNext}
              errorCallbackURL={googleErrorNext}
              disabled={busy || !googleReady}
              language={language}
            />
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
              {t.or}
            </FieldSeparator>
          </>
        )}
        {!emailOpen ? (
          // The other way in, shaped like the Google button above it.
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => setEmailOpen(true)}
          >
            <MailIcon data-icon="inline-start" />
            {t.useEmail}
          </Button>
        ) : emailLater ? (
          // Unfolds under the Google button. The padding keeps the fields'
          // focus rings inside the clipped area.
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={LAYOUT_MOVE}
            className="-m-1 overflow-hidden p-1"
          >
            <FieldGroup>{emailPart}</FieldGroup>
          </motion.div>
        ) : (
          emailPart
        )}
      </FieldGroup>
    </form>
  )
}
