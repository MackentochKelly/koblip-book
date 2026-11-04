import { expect, test } from "vitest"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { authError, passwordProblem } from "./auth-error"

for (const step of ["create", "password"] as const) {
  test.each([
    ["PASSWORD_TOO_SHORT", "password", "password"],
    ["PASSWORD_TOO_LONG", "password", "passwordTooLong"],
    ["INVALID_PASSWORD", "password", "invalidPassword"],
    ["INVALID_EMAIL", "email", "email"],
    ["INVALID_ORIGIN", "form", "failed"],
    ["FAILED_TO_CREATE_USER", "form", "failed"],
    ["UNKNOWN", "form", "failed"],
    ["__proto__", "form", "failed"],
    [undefined, "form", "failed"],
  ])(`${step}: %s maps to %s`, (code, field, message) => {
    expect(authError({ code, status: 400 }, step)).toEqual({ field, message })
  })

  test(`${step}: a failed connection belongs to the form`, () => {
    expect(authError(null, step)).toEqual({ field: "form", message: "connection" })
  })

  test.each([undefined, "INVALID_EMAIL_OR_PASSWORD", "PASSWORD_TOO_SHORT", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "INVALID_ORIGIN"])(
    `${step}: status 429 wins over code %s`, (code) => {
      expect(authError({ code, status: 429 }, step)).toEqual({ field: "form", message: "tooManyTries" })
    }
  )

  test(`${step}: wrong credentials are a password error only at log in`, () => {
    expect(authError({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, step)).toEqual(
      step === "password"
        ? { field: "password", message: "wrongPassword" }
        : { field: "form", message: "failed" }
    )
  })

  test(`${step}: an existing sign-up email becomes a calm log-in hint`, () => {
    expect(authError({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, step)).toEqual({
      field: "form", message: step === "create" ? "existingAccount" : "failed",
    })
  })
}

test("every password screen uses the same limits", () => {
  const { minPasswordLength: min, maxPasswordLength: max } = ONBOARDING_RULES
  expect(passwordProblem("x".repeat(min - 1))).toEqual({ field: "password", message: "password" })
  expect(passwordProblem("x".repeat(min))).toBeNull()
  expect(passwordProblem("x".repeat(max))).toBeNull()
  expect(passwordProblem("x".repeat(max + 1))).toEqual({ field: "password", message: "passwordTooLong" })
})
