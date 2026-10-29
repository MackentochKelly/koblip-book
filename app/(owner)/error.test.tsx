import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { OwnerLanguageProvider } from "@/features/dashboard/i18n/provider"
import OwnerError from "./error"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

test("a failed owner page says so in the owner's language and can try again", () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  const retry = vi.fn()
  render(
    <OwnerLanguageProvider language="es">
      <OwnerError error={new Error("boom")} retry={retry} />
    </OwnerLanguageProvider>
  )

  expect(screen.getByText("Algo salió mal")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }))
  expect(retry).toHaveBeenCalledOnce()
})
