"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { emailStatus } from "../api/email-status"
import { GoogleButton } from "./google-button"
import { GoogleError } from "./google-error"

type Step = "email" | "password" | "create"

// Email first: an existing account asks for its password, a new email asks
// for a name and a new password. One form for both, no sign-up page.
// After it, `onSignedIn` runs, or the screen opens `next`. Google first:
// it leaves the page and comes back to `googleNext` (default `next`).
export function AuthForm({
  next = "/dashboard",
  googleNext = next,
  googleReady = true,
  googleError = null,
  onSignedIn,
  disabled = false,
}: {
  next?: string
  googleNext?: string
  googleReady?: boolean
  // The `error` Google sign-in came back with, if any.
  googleError?: string | null
  onSignedIn?: () => Promise<void>
  disabled?: boolean
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const busy = sending || disabled

  const checkEmail = async () => {
    const status = await emailStatus(email).catch(() => null)
    if (!status?.ok) {
      setError("Check your email address")
      return
    }
    setError("")
    setStep(status.exists ? "password" : "create")
  }

  const logIn = async () => {
    if (step === "create" && !name.trim()) {
      setError("Add your name")
      return
    }
    if (password.length < ONBOARDING_RULES.minPasswordLength) {
      setError(`Use at least ${ONBOARDING_RULES.minPasswordLength} characters`)
      return
    }
    const { error: failed } =
      step === "create"
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
            // The link in the sign-up email opens this page, signed in.
            callbackURL: next,
          })
        : await authClient.signIn.email({ email: email.trim(), password })
    if (failed) {
      setError(
        step === "create"
          ? "That did not work. Please try again."
          : "Wrong password"
      )
      return
    }
    setError("")
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
    setError("")
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup>
        {step === "email" && (
          <>
            {googleError && <GoogleError code={googleError} />}
            <GoogleButton
              callbackURL={googleNext}
              disabled={busy || !googleReady}
            />
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
              or
            </FieldSeparator>
          </>
        )}
        <Field data-invalid={(step === "email" && Boolean(error)) || undefined}>
          <FieldLabel htmlFor="auth-email">Email</FieldLabel>
          <Input
            id="auth-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            readOnly={step !== "email"}
            disabled={busy}
            aria-invalid={(step === "email" && Boolean(error)) || undefined}
          />
          {step !== "email" && (
            <FieldDescription>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="dark:text-foreground"
                onClick={changeEmail}
              >
                Use another email
              </Button>
            </FieldDescription>
          )}
          {step === "email" && error && <FieldError>{error}</FieldError>}
        </Field>
        {step === "create" && (
          <Field>
            <FieldLabel htmlFor="auth-name">Your name</FieldLabel>
            <Input
              id="auth-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              disabled={busy}
              autoFocus
            />
          </Field>
        )}
        {step !== "email" && (
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="auth-password">
              {step === "create" ? "Choose a password" : "Password"}
            </FieldLabel>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                step === "create" ? "new-password" : "current-password"
              }
              disabled={busy}
              autoFocus={step === "password"}
              aria-invalid={Boolean(error) || undefined}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {step === "email"
            ? "Continue"
            : step === "create"
              ? "Create account"
              : "Log in"}
        </Button>
      </FieldGroup>
    </form>
  )
}
