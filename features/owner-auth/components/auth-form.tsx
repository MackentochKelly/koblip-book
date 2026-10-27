"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

const MIN_PASSWORD = 8

// Sign in or create a bookings account with an email and a password.
export function AuthForm({
  mode,
  next,
}: {
  mode: "sign-in" | "sign-up"
  next: string
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const signUp = mode === "sign-up"
  const other = signUp ? "/sign-in" : "/sign-up"
  const otherHref = next === "/dashboard" ? other : `${other}?next=${encodeURIComponent(next)}`

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending) return
    if (signUp && !name.trim()) {
      setError("Add your name")
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for the password`)
      return
    }
    setSending(true)
    setError("")
    const { error: failed } = signUp
      ? await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        })
      : await authClient.signIn.email({ email: email.trim(), password })
    setSending(false)
    if (failed) {
      setError(
        signUp
          ? "That email could not be used. Try signing in."
          : "Wrong email or password"
      )
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          {signUp ? "Create your bookings account" : "Sign in"}
        </CardTitle>
        <CardDescription>
          {signUp ? "Take bookings on your page." : "Manage your bookings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <FieldGroup>
            {signUp && (
              <Field>
                <FieldLabel htmlFor="auth-name">Name</FieldLabel>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  disabled={sending}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="auth-email">Email</FieldLabel>
              <Input
                id="auth-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={sending}
              />
            </Field>
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="auth-password">Password</FieldLabel>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={signUp ? "new-password" : "current-password"}
                disabled={sending}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <Field>
              <Button type="submit" size="lg" disabled={sending}>
                {sending && <Spinner data-icon="inline-start" />}
                {signUp ? "Create account" : "Sign in"}
              </Button>
              <FieldDescription className="text-center">
                {signUp ? "Have an account? " : "New here? "}
                <Link href={otherHref}>
                  {signUp ? "Sign in" : "Create an account"}
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
