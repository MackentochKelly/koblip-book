import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const { authClient, emailStatus } = vi.hoisted(() => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
    signUp: { email: vi.fn() },
    requestPasswordReset: vi.fn(),
  },
  emailStatus: vi.fn(async () => ({ ok: true, exists: true })),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/lib/auth-client", () => ({ authClient }))
vi.mock("../api/email-status", () => ({ emailStatus }))

const { AuthForm } = await import("./auth-form")
const { authWordsFor } = await import("../i18n")

afterEach(cleanup)
beforeEach(() => {
  emailStatus.mockReset().mockResolvedValue({ ok: true, exists: true })
  authClient.signIn.email.mockReset().mockRejectedValue(new Error("offline"))
  authClient.signUp.email.mockReset()
  authClient.requestPasswordReset.mockReset()
})

test("the login email is the field password managers fill", () => {
  const { unmount } = render(<AuthForm />)
  const email = screen.getByLabelText("Email")
  expect(email.getAttribute("autocomplete")).toBe("username")
  expect(email.getAttribute("name")).toBe("email")
  unmount()
})

test("a log in the server never answers shows an error and frees the form", async () => {
  render(<AuthForm />)
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Continue" }))
  fireEvent.change(await screen.findByLabelText("Password"), {
    target: { value: "long-enough-password" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Log in" }))

  expect(
    await screen.findByText("Can't connect. Check your connection and try again.")
  ).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement)
      .disabled
  ).toBe(false)
})

function onlyInvalid(field: "email" | "name" | "password" | "form", message: string) {
  const node = screen.getByText(message)
  const invalid = Array.from(document.querySelectorAll('[aria-invalid="true"]'))
  const groups = Array.from(document.querySelectorAll('[data-slot="field"][data-invalid="true"]'))
  if (field === "form") {
    expect(node.closest('[data-slot="alert"]')).not.toBeNull()
    expect(node.closest('[data-slot="field-error"]')).toBeNull()
    expect(invalid).toHaveLength(0)
    expect(groups).toHaveLength(0)
  } else {
    expect(invalid.map((input) => input.id)).toEqual([`auth-${field}`])
    expect(groups).toHaveLength(1)
    expect(groups[0].contains(node)).toBe(true)
    expect(node.closest('[data-slot="field-error"]')).not.toBeNull()
    expect(invalid[0].getAttribute("aria-describedby")).toBe(`auth-${field}-error`)
  }
}

for (const language of ["en", "es"] as const) {
  const t = authWordsFor(language)
  for (const step of ["create", "password"] as const) {
    const cases = [
      { code: "INVALID_EMAIL_OR_PASSWORD", status: 401, field: step === "password" ? "password" : "form", key: step === "password" ? "wrongPassword" : "failed" },
      { code: "PASSWORD_TOO_SHORT", status: 400, field: "password", key: "password" },
      { code: "PASSWORD_TOO_LONG", status: 400, field: "password", key: "passwordTooLong" },
      { code: "INVALID_PASSWORD", status: 400, field: "password", key: "invalidPassword" },
      { code: "INVALID_EMAIL", status: 400, field: "email", key: "email" },
      { code: "INVALID_ORIGIN", status: 403, field: "form", key: "failed" },
      { code: "FAILED_TO_CREATE_USER", status: 422, field: "form", key: "failed" },
      { code: "UNKNOWN", status: 500, field: "form", key: "failed" },
      { code: undefined, status: 429, field: "form", key: "tooManyTries" },
      { code: "PASSWORD_TOO_SHORT", status: 429, field: "form", key: "tooManyTries" },
      { code: null, status: 0, field: "form", key: "connection" },
      { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422, field: "form", key: step === "create" ? "existingAccount" : "failed" },
    ] as const
    for (const { code, status, field, key } of cases) {
      test(`${language} ${step}: ${code ?? status} shows ${key} on ${field}`, async () => {
        emailStatus.mockResolvedValue({ ok: true, exists: step === "password" })
        const request = step === "create" ? authClient.signUp.email : authClient.signIn.email
        // These mocks supply the same error shape as Better Auth's client.
        if (code === null) request.mockRejectedValue(new Error("offline"))
        else request.mockResolvedValue({ error: { code, status } })
        render(<AuthForm language={language} />)
        fireEvent.change(screen.getByLabelText(t.email), { target: { value: "owner@example.com" } })
        fireEvent.click(screen.getByRole("button", { name: t.continue }))
        const password = await screen.findByLabelText(step === "create" ? t.choosePassword : t.password)
        if (step === "create") fireEvent.change(screen.getByLabelText(t.yourName), { target: { value: "Owner" } })
        fireEvent.change(password, { target: { value: "long-enough-password" } })
        fireEvent.click(screen.getByRole("button", { name: step === "create" ? t.createAccount : t.logIn }))
        await screen.findByText(t.errors[key])
        onlyInvalid(field, t.errors[key])
        const alert = screen.getByText(t.errors[key]).closest('[data-slot="alert"]')
        if (key === "existingAccount") {
          expect(screen.queryByLabelText(t.yourName)).toBeNull()
          expect((screen.getByLabelText(t.password) as HTMLInputElement).value).toBe("")
          expect(screen.getByRole("button", { name: t.logIn })).toBeTruthy()
          expect(alert?.classList.contains("text-destructive")).toBe(false)
        } else if (field === "form") {
          expect(alert?.classList.contains("text-destructive")).toBe(true)
        }
        fireEvent.click(screen.getByRole("button", { name: t.useAnotherEmail }))
        expect(document.querySelector('[data-slot="alert"], [data-slot="field-error"], [aria-invalid="true"]')).toBeNull()
      })
    }
  }

  test(`${language}: a missing name marks only the name`, async () => {
    emailStatus.mockResolvedValue({ ok: true, exists: false })
    render(<AuthForm language={language} />)
    fireEvent.change(screen.getByLabelText(t.email), { target: { value: "new@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: t.continue }))
    await screen.findByLabelText(t.yourName)
    fireEvent.click(screen.getByRole("button", { name: t.createAccount }))
    await screen.findByText(t.errors.name)
    onlyInvalid("name", t.errors.name)
    expect(authClient.signUp.email).not.toHaveBeenCalled()
  })

  test(`${language}: local short-password validation marks only the password`, async () => {
    render(<AuthForm language={language} />)
    fireEvent.change(screen.getByLabelText(t.email), { target: { value: "owner@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: t.continue }))
    fireEvent.change(await screen.findByLabelText(t.password), { target: { value: "short" } })
    fireEvent.click(screen.getByRole("button", { name: t.logIn }))
    await screen.findByText(t.errors.password)
    onlyInvalid("password", t.errors.password)
    expect(authClient.signIn.email).not.toHaveBeenCalled()
  })
}

async function atPasswordStep(language: "en" | "es", next?: string) {
  const t = authWordsFor(language)
  render(<AuthForm language={language} next={next} />)
  fireEvent.change(screen.getByLabelText(t.email), {
    target: { value: "owner@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: t.continue }))
  return {
    t,
    forgot: await screen.findByRole("button", { name: t.forgotPassword }),
  }
}

for (const language of ["en", "es"] as const) {
  test(`${language}: forgot password asks for the link, keeping the language and the way back`, async () => {
    authClient.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null })
    const { t, forgot } = await atPasswordStep(language, "/connect")
    fireEvent.click(forgot)

    expect(await screen.findByText(t.resetSent)).toBeTruthy()
    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: "owner@example.com",
      redirectTo: `/reset-password?next=%2Fconnect&lang=${language}`,
    })
  })
}

test("forgot password says so when there were too many tries", async () => {
  authClient.requestPasswordReset.mockResolvedValue({
    data: null,
    error: { status: 429 },
  })
  const { t, forgot } = await atPasswordStep("en")
  fireEvent.click(forgot)

  expect(await screen.findByText(t.errors.tooManyTries)).toBeTruthy()
  expect(screen.queryByText(t.resetSent)).toBeNull()
})

test("forgot password says so when the server can't be reached", async () => {
  authClient.requestPasswordReset.mockRejectedValue(new Error("offline"))
  const { t, forgot } = await atPasswordStep("en")
  fireEvent.click(forgot)

  expect(await screen.findByText(t.errors.connection)).toBeTruthy()
})

test("a new account has no forgot password link", async () => {
  emailStatus.mockResolvedValue({ ok: true, exists: false })
  const t = authWordsFor("en")
  render(<AuthForm />)
  fireEvent.change(screen.getByLabelText(t.email), {
    target: { value: "new@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: t.continue }))
  await screen.findByLabelText(t.choosePassword)

  expect(screen.queryByRole("button", { name: t.forgotPassword })).toBeNull()
})
