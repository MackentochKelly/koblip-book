"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"

import { MailIcon } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { AFTER_LOGIN_PATH, resetPasswordHref } from "@/lib/auth-links"
import { LAYOUT_MOVE } from "@/lib/motion-tokens"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"
import { emailStatus } from "../api/email-status"
import { authWordsFor } from "../i18n"
import {
  authError,
  passwordProblem,
  type AuthError,
} from "../utils/auth-error"
import { AuthNotice } from "./auth-notice"
import { AuthSubmit } from "./auth-submit"
import { GoogleButton } from "./google-button"
import { GoogleError } from "./google-error"
import { PasswordField } from "./password-field"
import { noAutofill } from "@/lib/no-autofill"

type Step = "email" | "password" | "create"

// A small way out of a step: quiet, so its main button stays the one main
// action.
function QuietAction({
  disabled,
  onClick,
  className,
  children,
}: {
  disabled: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      className={cn("px-0 text-muted-foreground", className)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

// Email first: an existing account asks for its password, a new email asks
// for a name and a new password. One form for both, no sign-up page.
// After it, `onSignedIn` runs, or the screen opens `next`. Google and the
// "Forgot password" email leave the page: both come back to `googleNext`
// (default `next`). `language` picks its words. `emailLater`: Google alone at
// first, the email form unfolds under it when asked for.
export function AuthForm({
  next = AFTER_LOGIN_PATH,
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
    setStep(status.exists ? "password" : "create")
  }

  const logIn = async () => {
    if (step === "create" && !name.trim()) {
      setError({ field: "name", message: "name" })
      return
    }
    const problem = passwordProblem(password)
    if (problem) {
      setError(problem)
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
    if (onSignedIn) {
      await onSignedIn()
      return
    }
    router.replace(next)
    router.refresh()
  }

  // Its link opens the new password page, and that page leads back here.
  const forgotPassword = async () => {
    // Null when the server could not be reached.
    const result = await authClient
      .requestPasswordReset({
        email: email.trim(),
        redirectTo: resetPasswordHref({ next: googleNext, language }),
      })
      .catch(() => null)
    if (!result || result.error) {
      setError(authError(result?.error ?? null, "password"))
      return
    }
    setResetSent(true)
  }

  // One request at a time, starting from a clean slate.
  const run = async (work: () => Promise<void>) => {
    if (busy) return
    setError(null)
    setResetSent(false)
    setSending(true)
    try {
      await work()
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
          <PasswordField
            id="auth-password"
            label={step === "create" ? t.choosePassword : t.password}
            value={password}
            onChange={setPassword}
            autoComplete={step === "create" ? "new-password" : "current-password"}
            autoFocus={step === "password"}
            disabled={busy}
            error={error?.field === "password" ? t.errors[error.message] : null}
          >
            {/* They share a line, to save room. "Use another email" keeps its
                side on log in and sign-up alike. */}
            <div className="flex flex-wrap gap-x-4">
              {step === "password" && (
                <QuietAction disabled={busy} onClick={() => void run(forgotPassword)}>
                  {t.forgotPassword}
                </QuietAction>
              )}
              <QuietAction disabled={busy} onClick={changeEmail} className="ms-auto">
                {t.useAnotherEmail}
              </QuietAction>
            </div>
          </PasswordField>
        )}
        {resetSent && <AuthNotice kind="mail">{t.resetSent}</AuthNotice>}
        {error?.field === "form" && (
          <AuthNotice kind={error.message === "existingAccount" ? "info" : "error"}>
            {t.errors[error.message]}
          </AuthNotice>
        )}
        <AuthSubmit busy={busy}>
          {step === "email"
            ? t.continue
            : step === "create"
              ? t.createAccount
              : t.logIn}
        </AuthSubmit>
    </>
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void run(step === "email" ? checkEmail : logIn)
      }}
      noValidate
    >
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
