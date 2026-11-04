import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { ONBOARDING_RULES } from "@/lib/onboarding-rules"

const { authClient } = vi.hoisted(() => ({
  authClient: { resetPassword: vi.fn() },
}))

vi.mock("@/lib/auth-client", () => ({ authClient }))

const { ResetPasswordForm } = await import("./reset-password-form")
const { authWordsFor } = await import("../i18n")

const LONG_ENOUGH = "x".repeat(ONBOARDING_RULES.minPasswordLength)

afterEach(cleanup)
beforeEach(() => {
  authClient.resetPassword.mockReset()
})

function submit(language: "en" | "es", password = LONG_ENOUGH) {
  const t = authWordsFor(language)
  render(<ResetPasswordForm token="abc" next="/connect" language={language} />)
  fireEvent.change(screen.getByLabelText(t.password), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole("button", { name: t.savePassword }))
  return t
}

for (const language of ["en", "es"] as const) {
  test(`${language}: a saved password leads to log in, keeping the way back`, async () => {
    authClient.resetPassword.mockResolvedValue({ data: { status: true }, error: null })
    const t = submit(language)

    expect(await screen.findByText(t.passwordChanged)).toBeTruthy()
    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: LONG_ENOUGH,
      token: "abc",
    })
    expect(screen.getByRole("button", { name: t.logIn }).getAttribute("href")).toBe(
      `/login?next=%2Fconnect&lang=${language}`
    )
  })

  test(`${language}: a link without a token only leads back to log in`, () => {
    const t = authWordsFor(language)
    render(<ResetPasswordForm token={null} next="/dashboard" language={language} />)

    expect(screen.getByText(t.linkExpired)).toBeTruthy()
    expect(screen.queryByLabelText(t.password)).toBeNull()
    expect(screen.getByRole("button", { name: t.backToLogIn })).toBeTruthy()
  })
}

test("a short password stays here and asks for no server", () => {
  const t = submit("en", "short")

  expect(screen.getByText(t.errors.password)).toBeTruthy()
  expect(authClient.resetPassword).not.toHaveBeenCalled()
})

test("a link used in the meantime ends at log in", async () => {
  authClient.resetPassword.mockResolvedValue({
    data: null,
    error: { code: "INVALID_TOKEN", status: 400 },
  })
  const t = submit("en")

  expect(await screen.findByText(t.linkExpired)).toBeTruthy()
})

test("a server that can't be reached says so and frees the form", async () => {
  authClient.resetPassword.mockRejectedValue(new Error("offline"))
  const t = submit("en")

  expect(await screen.findByText(t.errors.connection)).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: t.savePassword }) as HTMLButtonElement).disabled
  ).toBe(false)
})
