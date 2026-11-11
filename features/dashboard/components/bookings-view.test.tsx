import { cleanup, render, screen, within } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { WithWords } from "@/i18n/testing"
import type { OwnerBooking } from "../types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))
vi.mock("../api/actions", () => ({ cancelBooking: vi.fn() }))
vi.mock("../api/booking-actions", () => ({ setBookingStatus: vi.fn() }))
vi.mock("../api/payment-actions", () => ({ setBookingPaid: vi.fn() }))
vi.mock("../api/online-pay-actions", () => ({ refundBooking: vi.fn() }))
vi.mock("../api/customer-reward-actions", () => ({
  bookingRewards: vi.fn(async () => []),
  redeemForBooking: vi.fn(),
  rewardsOfCustomer: vi.fn(async () => []),
}))
// Only the Assistant widget matters here; the board's drag and drop does not.
vi.mock("./widget-board", () => ({
  WidgetBoard: ({ widgets }: { widgets: { today: ReactNode } }) => (
    <div data-testid="assistant-widget">{widgets.today}</div>
  ),
}))

const { BookingsView } = await import("./bookings-view")

afterEach(cleanup)

const today = "2026-10-31"
const now = "2026-10-31T15:00:00.000Z"

const booking = (over: Partial<OwnerBooking>): OwnerBooking =>
  ({
    id: "b",
    date: today,
    status: "confirmed",
    startAt: "2026-10-31T10:00:00.000Z",
    customerName: "Ana",
    ...over,
  }) as OwnerBooking

function home(past: OwnerBooking[] = []) {
  const props = {
    businessId: "b1",
    upcoming: [],
    past,
    now,
    greeting: "Good afternoon, Kelly",
    assistant: <p>Ask box</p>,
    summary: {},
    currency: "USD",
    widgets: {
      layout: { order: [], hidden: [] },
      device: false,
      comingUp: {},
      newCustomers: [],
      page: { slug: "shop", name: "Shop" },
    },
    addOptions: {
      services: [],
      team: [],
      serviceTeams: [],
      addonGroups: [],
      today,
      whatsapp: false,
    },
  } as unknown as ComponentProps<typeof BookingsView>
  render(<BookingsView {...props} />, { wrapper: WithWords })
}

test("today's line sits right under the greeting", () => {
  home([booking({})])
  const greeting = screen.getByText("Good afternoon, Kelly")
  expect(greeting.nextElementSibling?.textContent).toBe(
    "1 booking today · none left to start"
  )
})

test("says so when there is nothing today", () => {
  home()
  expect(screen.getByText("No bookings today")).toBeTruthy()
})

test("the Assistant widget holds only the assistant", () => {
  home([booking({})])
  const widget = within(screen.getByTestId("assistant-widget"))
  expect(widget.getByText("Ask box")).toBeTruthy()
  expect(widget.queryByText(/booking/i)).toBeNull()
})
