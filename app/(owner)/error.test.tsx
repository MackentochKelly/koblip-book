import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { WithWords } from "@/i18n/testing"
import OwnerError from "./error"

test("a failed owner page says so and can try again", () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  const retry = vi.fn()
  render(
    <WithWords>
      <OwnerError error={new Error("boom")} retry={retry} />
    </WithWords>
  )

  expect(screen.getByText("Something went wrong")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(retry).toHaveBeenCalledOnce()
})
