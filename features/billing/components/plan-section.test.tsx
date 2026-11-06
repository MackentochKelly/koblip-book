import { cleanup, fireEvent, render as renderPart, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { WithWords } from "@/i18n/testing"
import type { Billing } from "../types"

const { subscription, toast } = vi.hoisted(() => ({
  subscription: { upgrade: vi.fn(), billingPortal: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("sonner", () => ({ toast }))
vi.mock("@/lib/auth-client", () => ({ authClient: { subscription } }))

const { PlanSection } = await import("./plan-section")
const render = (ui: React.ReactElement) => renderPart(ui, { wrapper: WithWords })

const prices: Billing["prices"] = {
  monthly: { amountMinor: 1900, currency: "USD" },
  yearly: { amountMinor: 19000, currency: "USD" },
}

// jsdom has neither; the switcher scrolls its open tab into view.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false }))
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("on Free: Free is current, and Upgrade buys the period picked", async () => {
  subscription.upgrade.mockResolvedValue({ error: null })
  render(
    <PlanSection businessId="b1" billing={{ plan: "free", subscription: null, prices }} />
  )
  expect(screen.getByText("Current")).toBeTruthy()
  expect(screen.getByText("$19.00 a month")).toBeTruthy()

  fireEvent.click(screen.getByRole("tab", { name: "Yearly" }))
  expect(screen.getByText("$190.00 a year")).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Upgrade" }))
  await waitFor(() =>
    expect(subscription.upgrade).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", annual: true, referenceId: "b1" })
    )
  )
  expect(screen.queryByRole("button", { name: "Manage billing" })).toBeNull()
})

test("on Pro: Pro is current with its renewal, and Manage billing opens the portal", async () => {
  subscription.billingPortal.mockResolvedValue({ error: null })
  render(
    <PlanSection
      businessId="b1"
      billing={{
        plan: "pro",
        subscription: {
          status: "active",
          endsAt: "2026-12-06T00:00:00.000Z",
          cancelling: false,
          yearly: false,
        },
        prices,
      }}
    />
  )
  expect(screen.getByText("Renews Dec 6, 2026")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Upgrade" })).toBeNull()
  expect(screen.queryByRole("tablist")).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Manage billing" }))
  await waitFor(() =>
    expect(subscription.billingPortal).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: "b1" })
    )
  )
})

test("a failed payment asks for the card, and a Stripe error says so", async () => {
  subscription.billingPortal.mockResolvedValue({ error: { message: "no" } })
  render(
    <PlanSection
      businessId="b1"
      billing={{
        plan: "free",
        subscription: { status: "past_due", endsAt: null, cancelling: false, yearly: false },
        prices,
      }}
    />
  )
  expect(screen.getByText("Payment failed")).toBeTruthy()
  expect(screen.getByText("Update your card to keep Pro")).toBeTruthy()
  expect(screen.queryByText("Current")).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Manage billing" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
})
