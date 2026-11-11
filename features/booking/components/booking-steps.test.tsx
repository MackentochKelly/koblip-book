import {
  cleanup,
  fireEvent,
  render as renderPlain,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WithWords } from "@/i18n/testing"
import type { BookingPage, BookingService } from "./booking-page"
import { DetailsStep, PaymentStep, ServiceStep } from "./booking-steps"

// Where to send the money is asked from the server once a way is picked.
vi.mock("../api/payment-details", () => ({
  getPaymentDetails: vi.fn(async () => "pay@shop.example"),
}))

// The parts read their words from next-intl, in English.
const render = (ui: React.ReactElement) =>
  renderPlain(ui, { wrapper: WithWords })

const service = (
  id: string,
  categoryId: string | null = null
): BookingService => ({
  id,
  name: id,
  durationMinutes: 30,
  priceMinor: null,
  categoryId,
})

const page = (
  services: BookingService[],
  serviceCategories: BookingPage["serviceCategories"] = []
): BookingPage => ({
  slug: "shop",
  name: "Shop",
  photoUrl: null,
  address: null,
  directionsUrl: null,
  phone: null,
  timeZone: "America/Santo_Domingo",
  currency: "DOP",
  services,
  serviceCategories,
  team: [],
  serviceTeams: {},
  addonGroups: [],
  whatsapp: false,
  policies: { documents: [], points: [] },
})

const categories = [
  { id: "hair", name: "Hair" },
  { id: "nails", name: "Nails" },
]

let reduceMotion = false
const scrollIntoView = vi.fn()

beforeEach(() => {
  // jsdom has none of these; the jump tabs use them.
  reduceMotion = false
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: reduceMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
  scrollIntoView.mockClear()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

const names = (groups: HTMLElement[]) =>
  groups.map((group) => group.querySelector("legend")?.textContent)

describe("ServiceStep", () => {
  it("without categories is the flat list of choices, no titles or tabs", () => {
    const { container } = render(
      <ServiceStep
        page={page([service("Cut"), service("Trim")])}
        mode="drawer"
        value=""
        onChange={() => {}}
      />
    )
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(container.querySelector("fieldset")).toBeNull()
    expect(screen.queryByRole("tablist")).toBeNull()
  })

  it("puts each group under its title in one choice, Other last, with jump tabs", () => {
    const onChange = vi.fn()
    const { container } = render(
      <ServiceStep
        page={page(
          [
            service("Polish", "nails"),
            service("Wash"),
            service("Cut", "hair"),
          ],
          categories
        )}
        mode="page"
        value=""
        onChange={onChange}
      />
    )
    const groups = [...container.querySelectorAll("fieldset")]
    expect(names(groups)).toEqual(["Hair", "Nails", "Other"])
    expect(
      within(groups[0]).getAllByRole("radio")
    ).toHaveLength(1)
    // One choice across the groups.
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1)
    const tabs = screen.getByRole("tablist", { name: "Service categories" })
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["Hair", "Nails", "Other"])

    fireEvent.click(within(tabs).getByRole("tab", { name: "Nails" }))
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    })
    expect(scrollIntoView.mock.contexts[0]).toBe(groups[1])
  })

  it("jumps without the slide when Reduce Motion is on", () => {
    reduceMotion = true
    render(
      <ServiceStep
        page={page([service("Cut", "hair"), service("Wash")], categories)}
        mode="drawer"
        value=""
        onChange={() => {}}
      />
    )
    fireEvent.click(screen.getByRole("tab", { name: "Hair" }))
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    })
  })

  it("leaves out empty groups, and shows no tabs for a single group", () => {
    // Booked from a team member who only does nails.
    const { container } = render(
      <ServiceStep
        page={page([service("Polish", "nails")], categories)}
        mode="drawer"
        value=""
        onChange={() => {}}
      />
    )
    expect(names([...container.querySelectorAll("fieldset")])).toEqual([
      "Nails",
    ])
    expect(screen.queryByRole("tablist")).toBeNull()
  })
})

describe("PaymentStep", () => {
  afterEach(cleanup)
  const payments = (asksProof: boolean) => ({
    methods: [{ id: "m1", type: "zelle" as const, name: "Zelle" }],
    card: null,
    payLater: true,
    asksProof,
  })
  const step = (asksProof: boolean, value: string) => (
    <PaymentStep
      slug="shop"
      payments={payments(asksProof)}
      value={value}
      onChange={() => {}}
      proof={null}
      onProofChange={() => {}}
    />
  )

  it("shows where to pay and asks for payment proof once a way is picked", async () => {
    render(step(true, "m1"))
    expect(await screen.findByText("pay@shop.example")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add payment proof" })).toBeTruthy()
  })

  it("copies where to pay in one tap, and says so", async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    render(step(true, "m1"))
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }))
    expect(writeText).toHaveBeenCalledWith("pay@shop.example")
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
  })

  it("asks for nothing when paying later, or when the business does not ask", () => {
    render(step(true, "later"))
    expect(screen.queryByRole("button", { name: "Add payment proof" })).toBeNull()
    cleanup()
    render(step(false, "m1"))
    expect(screen.queryByRole("button", { name: "Add payment proof" })).toBeNull()
  })
})

describe("DetailsStep", () => {
  const step = (signIn: React.ReactNode) => (
    <WithWords>
      <DetailsStep
        formId="details"
        sending={false}
        error="email"
        whatsappFrom={null}
        signIn={signIn}
        details={{ name: "Ana", phone: "+18095550134", email: "ana@" }}
        onDetailsChange={() => {}}
        onSubmit={() => {}}
      />
    </WithWords>
  )

  it("asks for an email and says when it is wrong", () => {
    render(step(null))
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "ana@"
    )
    expect(screen.queryByText("Check your email")).not.toBeNull()
  })

  it("shows the sign-in above the form only when one is given", () => {
    const { rerender } = render(step(<button>Sign in here</button>))
    const signIn = screen.getByRole("button", { name: "Sign in here" })
    expect(
      signIn.compareDocumentPosition(screen.getByLabelText("Name")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    rerender(step(null))
    expect(screen.queryByRole("button", { name: "Sign in here" })).toBeNull()
  })
})
