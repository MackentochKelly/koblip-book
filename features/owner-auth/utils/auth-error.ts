import type { authClient } from "@/lib/auth-client"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type en from "../i18n/en"

type ErrorCode = keyof typeof authClient.$ERROR_CODES

export type AuthError = {
  field: "email" | "name" | "password" | "form"
  message: keyof typeof en.errors
}

// Better Auth's codes pick our words, never its message strings
// (better-auth.com/docs/concepts/client#handling-errors). A 429 can have
// no code (better-auth.com/docs/concepts/rate-limit#handling-rate-limit-errors).
const FIELDS = {
  PASSWORD_TOO_SHORT: { field: "password", message: "password" },
  PASSWORD_TOO_LONG: { field: "password", message: "passwordTooLong" },
  INVALID_PASSWORD: { field: "password", message: "invalidPassword" },
  INVALID_EMAIL: { field: "email", message: "email" },
} satisfies Partial<Record<ErrorCode, AuthError>>

// The same rule on every screen a password is typed, before asking the
// server: Better Auth's limits, set from these rules (lib/auth.ts).
export function passwordProblem(password: string): AuthError | null {
  if (password.length < ONBOARDING_RULES.minPasswordLength) {
    return { field: "password", message: "password" }
  }
  if (password.length > ONBOARDING_RULES.maxPasswordLength) {
    return { field: "password", message: "passwordTooLong" }
  }
  return null
}

export function authError(
  error: { code?: string; status: number } | null,
  step: "create" | "password"
): AuthError {
  if (!error) return { field: "form", message: "connection" }
  if (error.status === 429) return { field: "form", message: "tooManyTries" }
  if (step === "password" && error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return { field: "password", message: "wrongPassword" }
  }
  if (step === "create" && error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return { field: "form", message: "existingAccount" }
  }
  if (error.code && Object.hasOwn(FIELDS, error.code)) {
    return FIELDS[error.code as keyof typeof FIELDS]
  }
  return { field: "form", message: "failed" }
}
