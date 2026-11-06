import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { WithWords } from "@/i18n/testing"
import type { AdminSubscription } from "../api/subscriptions"
import { SubscriptionsList } from "./subscriptions-list"

vi.mock("./remove-free-pro", () => ({
  RemoveFreePro: ({ name }: { name: string }) => <button>Remove {name}</button>,
}))

afterEach(cleanup)

const SUB: AdminSubscription = {
  id: "s1",
  businessName: "Ana's Salon",
  ownerName: "Ana",
  ownerEmail: "ana@x.com",
  plan: "pro",
  status: "active",
  yearly: false,
  periodEnd: "2026-12-06T00:00:00.000Z",
  cancelling: false,
  endedAt: null,
  stripeUrl: "https://dashboard.stripe.com/test/subscriptions/sub_1",
  customerUrl: "https://dashboard.stripe.com/test/customers/cus_1",
  grant: null,
}

const show = (subscriptions: AdminSubscription[]) =>
  render(
    <WithWords>
      <SubscriptionsList subscriptions={subscriptions} />
    </WithWords>
  )

test("a live subscription shows its plan, renewal and Stripe links", () => {
  show([SUB])
  expect(screen.getByText("Active")).toBeTruthy()
  expect(screen.getByText("Pro · Monthly · Renews Dec 6, 2026")).toBeTruthy()
  expect(
    screen.getByLabelText("Open Ana's Salon's subscription in Stripe").getAttribute("href")
  ).toBe(SUB.stripeUrl)
  expect(screen.getByText("Customer").closest("a")?.getAttribute("href")).toBe(SUB.customerUrl)
})

test("history: a failed payment, a cancelling plan and an ended one", () => {
  show([
    { ...SUB, id: "s2", status: "past_due" },
    { ...SUB, id: "s3", yearly: true, cancelling: true },
    { ...SUB, id: "s4", status: "canceled", endedAt: "2026-10-01T00:00:00.000Z" },
  ])
  expect(screen.getByText("Payment failed")).toBeTruthy()
  expect(screen.getByText("Pro · Yearly · Ends Dec 6, 2026")).toBeTruthy()
  expect(screen.getByText("Canceled")).toBeTruthy()
  expect(screen.getByText("Pro · Monthly · Ended Oct 1, 2026")).toBeTruthy()
})

test("free Pro: who gave it, Remove while it lasts, and who took it back", () => {
  const grant = { id: 1, givenBy: "Kelly", givenAt: "2026-11-06T00:00:00.000Z", removedBy: null, removedAt: null }
  show([
    { ...SUB, grant },
    {
      ...SUB,
      id: "s5",
      businessName: "Old Shop",
      status: "canceled",
      endedAt: "2026-11-07T00:00:00.000Z",
      grant: { ...grant, id: 2, removedBy: "Kelly", removedAt: "2026-11-07T00:00:00.000Z" },
    },
  ])
  expect(screen.getAllByText("Given free")).toHaveLength(2)
  expect(screen.getByText("Given by Kelly on Nov 6, 2026")).toBeTruthy()
  expect(
    screen.getByText("Given by Kelly on Nov 6, 2026 · Removed by Kelly on Nov 7, 2026")
  ).toBeTruthy()
  expect(screen.getByRole("button", { name: "Remove Ana's Salon" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Remove Old Shop" })).toBeNull()
})
