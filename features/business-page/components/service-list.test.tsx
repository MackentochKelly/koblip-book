import {
  cleanup,
  fireEvent,
  render as renderPlain,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WithWords } from "@/i18n/testing"
import type { Service } from "../types"
import { ServiceList } from "./service-list"

// The parts read their words from next-intl, in English.
const render = (ui: React.ReactElement) =>
  renderPlain(ui, { wrapper: WithWords })

const service = (n: number, extra: Partial<Service> = {}) =>
  ({
    id: `s${n}`,
    businessId: "b",
    name: `Service ${n}`,
    description: null,
    durationMinutes: 30,
    priceMinor: 50000,
    position: n,
    categoryId: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  }) as Service

beforeEach(() => {
  // jsdom has neither; the category tabs use both.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  Element.prototype.scrollTo = vi.fn()
})

afterEach(cleanup)

describe("ServiceList", () => {
  it("renders nothing without services", () => {
    const { container } = render(
      <ServiceList
        services={[]}
        serviceCategories={[]}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    expect(container.innerHTML).toBe("")
  })

  it("shows three, and See all opens booking", () => {
    render(
      <ServiceList
        services={[1, 2, 3, 4].map((n) => service(n))}
        serviceCategories={[]}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    expect(screen.queryByText("Service 4")).toBeNull()
    expect(screen.queryByRole("tablist")).toBeNull()
    const links = screen
      .getAllByText("See all")
      .map((text) => text.closest("a")?.getAttribute("href"))
    expect(links).toContain("/b/test?book=1")
    expect(links).toContain("/b/test/book")
  })

  it("hides a missing price, says Free for zero, drops a description that repeats the name", () => {
    render(
      <ServiceList
        services={[
          service(1, { priceMinor: null, description: "service 1" }),
          service(2, { priceMinor: 0 }),
        ]}
        serviceCategories={[]}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    expect(screen.getByText("Free")).toBeTruthy()
    expect(screen.queryByText(/Price varies/)).toBeNull()
    expect(screen.queryByText(/· service 1/)).toBeNull()
  })

  it("with two or more groups, a tab per group shows that group's first three, Other last", () => {
    render(
      <ServiceList
        services={[
          service(1, { categoryId: "nails" }),
          service(2),
          service(3, { categoryId: "hair" }),
          service(4, { categoryId: "hair" }),
          service(5, { categoryId: "hair" }),
          service(6, { categoryId: "hair" }),
        ]}
        serviceCategories={[
          { id: "hair", name: "Hair" },
          { id: "nails", name: "Nails" },
          { id: "brows", name: "Brows" },
        ]}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    const tabs = screen.getByRole("tablist", { name: "Service categories" })
    // Brows has no services, so customers never see it.
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["Hair", "Nails", "Other"])
    expect(screen.getByText("Service 3")).toBeTruthy()
    expect(screen.getByText("Service 5")).toBeTruthy()
    expect(screen.queryByText("Service 6")).toBeNull()
    expect(screen.queryByText("Service 1")).toBeNull()
    expect(screen.getAllByText("See all").length).toBeGreaterThan(0)

    fireEvent.click(within(tabs).getByRole("tab", { name: "Other" }))
    expect(screen.getByText("Service 2")).toBeTruthy()
    expect(screen.queryByText("Service 3")).toBeNull()
  })

  it("with one group only, shows today's list with no tabs", () => {
    render(
      <ServiceList
        services={[
          service(1, { categoryId: "hair" }),
          service(2, { categoryId: "hair" }),
        ]}
        serviceCategories={[{ id: "hair", name: "Hair" }]}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    expect(screen.queryByRole("tablist")).toBeNull()
    expect(screen.queryByText("Hair")).toBeNull()
    expect(screen.getByText("Service 1")).toBeTruthy()
    expect(screen.getByText("Service 2")).toBeTruthy()
    expect(screen.queryByText("See all")).toBeNull()
  })
})
