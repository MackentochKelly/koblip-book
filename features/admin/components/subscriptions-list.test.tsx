import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"

import { WithWords } from "@/i18n/testing"
import type { AdminSubscription } from "../api/subscriptions"
import { SubscriptionsList } from "./subscriptions-list"

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
