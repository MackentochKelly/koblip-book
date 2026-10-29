import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test, vi } from "vitest"

const { authClient, emailStatus } = vi.hoisted(() => ({
  authClient: {
    signIn: {
      email: vi.fn(async () => {
        throw new Error("offline")
      }),
      social: vi.fn(),
    },
    signUp: { email: vi.fn() },
  },
  emailStatus: vi.fn(async () => ({ ok: true, exists: true })),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/lib/auth-client", () => ({ authClient }))
vi.mock("../api/email-status", () => ({ emailStatus }))

const { AuthForm } = await import("./auth-form")

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
    await screen.findByText("That did not work. Please try again.")
  ).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement)
      .disabled
  ).toBe(false)
})
