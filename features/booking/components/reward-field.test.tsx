import {
  cleanup,
  fireEvent,
  render as renderPlain,
  screen,
} from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { WithWords } from "@/i18n/testing"
import type { HeldReward } from "@/lib/reward-rules"
import type { BookingPage } from "./booking-page"
import { BookingSummary, RewardField } from "./booking-steps"

// The reward on the booking screens (docs/plans/rewards.md, RW-6).
vi.mock("../api/payment-details", () => ({ getPaymentDetails: vi.fn() }))

const render = (ui: React.ReactElement) =>
  renderPlain(ui, { wrapper: WithWords })

afterEach(cleanup)

const freeCut: HeldReward = {
  id: "w1",
  reward: {
    type: "free",
    value: null,
    maxDiscountMinor: null,
    services: [{ id: "cut", name: "Haircut" }],
  },
  expiresAt: null,
}

const page: BookingPage = {
  slug: "shop",
  name: "Shop",
  photoUrl: null,
  address: null,
  directionsUrl: null,
  phone: null,
  timeZone: "America/Santo_Domingo",
  currency: "USD",
  services: [],
  serviceCategories: [],
  team: [],
  serviceTeams: {},
  addonGroups: [],
  whatsapp: false,
  policies: { documents: [], points: [] },
}

test("a customer with a reward gets a switch to redeem it", () => {
  const onChange = vi.fn()
  render(
    <RewardField
      rewards={{ state: "mine", rewards: [freeCut] }}
      offer={freeCut}
      currency="USD"
      on={false}
      onChange={onChange}
      loginHref="/login"
      disabled={false}
    />
  )
  fireEvent.click(screen.getByRole("switch", { name: "Redeem Free Haircut" }))
  expect(onChange).toHaveBeenCalledWith(true, expect.anything())
})

test("signed out, the one step is Sign in; without a phone, Add phone", () => {
  const { rerender } = render(
    <RewardField
      rewards={{ state: "signedOut" }}
      offer={null}
      currency="USD"
      on={false}
      onChange={() => {}}
      loginHref="/login?next=here"
      disabled={false}
    />
  )
  expect(screen.getByText("Sign in to see your rewards")).toBeTruthy()
  expect(screen.getByText("Sign in").closest("a")?.getAttribute("href")).toBe(
    "/login?next=here"
  )
  rerender(
    <RewardField
      rewards={{ state: "noPhone" }}
      offer={null}
      currency="USD"
      on={false}
      onChange={() => {}}
      loginHref="/login"
      disabled={false}
    />
  )
  expect(screen.getByText("Add phone").closest("a")?.getAttribute("href")).toBe(
    "/account/profile?phone=add"
  )
})

test("with nothing to offer, nothing shows", () => {
  const { container } = render(
    <RewardField
      rewards={{ state: "mine", rewards: [] }}
      offer={null}
      currency="USD"
      on={false}
      onChange={() => {}}
      loginHref="/login"
      disabled={false}
    />
  )
  expect(container.textContent).toBe("")
})

test("the summary shows what the reward takes off, and the new total", () => {
  render(
    <BookingSummary
      page={page}
      service={{
        id: "cut",
        name: "Haircut",
        durationMinutes: 30,
        priceMinor: 2500,
        categoryId: null,
      }}
      groups={[]}
      addonIds={[]}
      member={null}
      slot={null}
      discountMinor={2500}
    />
  )
  expect(screen.getByText("Reward")).toBeTruthy()
  expect(screen.getByText("-$25.00")).toBeTruthy()
  expect(screen.getByText("Free")).toBeTruthy()
})
