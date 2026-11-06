import { cleanup, fireEvent, render as renderUi, screen } from "@testing-library/react"
import { createTranslator } from "next-intl"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import messages from "@/i18n/messages"
import { WithWords } from "@/i18n/testing"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"

const { authClient } = vi.hoisted(() => ({
  authClient: { resetPassword: vi.fn() },
}))

vi.mock("@/lib/auth-client", () => ({ authClient }))

const { ResetPasswordForm } = await import("./reset-password-form")

// The form's English words, as the person reads them.
const t = messages.ownerAuth
const translate = createTranslator({ locale: "en-US", messages, namespace: "ownerAuth" })
const errorText = (key: keyof typeof t.errors) =>
  translate(`errors.${key}`, {
    min: ONBOARDING_RULES.minPasswordLength,
    max: ONBOARDING_RULES.maxPasswordLength,
  })

const render = (ui: React.ReactElement) => renderUi(ui, { wrapper: WithWords })

const LONG_ENOUGH = "x".repeat(ONBOARDING_RULES.minPasswordLength)

afterEach(cleanup)
beforeEach(() => {
  authClient.resetPassword.mockReset()
})

function submit(language: "en" | "es" = "en", password = LONG_ENOUGH) {
  render(<ResetPasswordForm token="abc" next="/connect" language={language} />)
  fireEvent.change(screen.getByLabelText(t.password), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole("button", { name: t.savePassword }))
}

// The language is the page's: it goes on in the way back to log in.
for (const language of ["en", "es"] as const) {
  test(`${language}: a saved password leads to log in, keeping the way back`, async () => {
    authClient.resetPassword.mockResolvedValue({ data: { status: true }, error: null })
    submit(language)

    expect(await screen.findByText(t.passwordChanged)).toBeTruthy()
    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: LONG_ENOUGH,
      token: "abc",
    })
    expect(screen.getByRole("button", { name: t.logIn }).getAttribute("href")).toBe(
      `/login?next=%2Fconnect&lang=${language}`
    )
  })

}

test("a link without a token only leads back to log in", () => {
  render(<ResetPasswordForm token={null} next="/dashboard" language="en" />)

  expect(screen.getByText(t.linkExpired)).toBeTruthy()
  expect(screen.queryByLabelText(t.password)).toBeNull()
  expect(screen.getByRole("button", { name: t.backToLogIn })).toBeTruthy()
})

test("a short password stays here and asks for no server", () => {
  submit("en", "short")

  expect(screen.getByText(errorText("password"))).toBeTruthy()
  expect(authClient.resetPassword).not.toHaveBeenCalled()
})

test("a link used in the meantime ends at log in", async () => {
  authClient.resetPassword.mockResolvedValue({
    data: null,
    error: { code: "INVALID_TOKEN", status: 400 },
  })
  submit()

  expect(await screen.findByText(t.linkExpired)).toBeTruthy()
})

test("a server that can't be reached says so and frees the form", async () => {
  authClient.resetPassword.mockRejectedValue(new Error("offline"))
  submit()

  expect(await screen.findByText(errorText("connection"))).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: t.savePassword }) as HTMLButtonElement).disabled
  ).toBe(false)
})
