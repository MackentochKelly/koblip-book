import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"
import type { Service } from "../types"
import { ServiceList } from "./service-list"

const service = (n: number, extra: Partial<Service> = {}) =>
  ({
    id: `s${n}`,
    businessId: "b",
    name: `Service ${n}`,
    description: null,
    durationMinutes: 30,
    priceMinor: 50000,
    position: n,
    createdAt: "",
    updatedAt: "",
    ...extra,
  }) as Service

describe("ServiceList", () => {
  // The panel picks a phone sheet or a dialog by screen size.
  beforeAll(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
  })

  it("renders nothing without services", () => {
    const { container } = render(
      <ServiceList services={[]} currency="DOP" slug="test" bookable={false} />
    )
    expect(container.innerHTML).toBe("")
  })

  it("shows three, then all in a panel after See all", () => {
    render(
      <ServiceList
        services={[1, 2, 3, 4].map((n) => service(n))}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    expect(screen.queryByText("Service 4")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "See all" }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByText("Service 4")).toBeTruthy()
  })

  it("hides a missing price, says Free for zero, drops a description that repeats the name", () => {
    render(
      <ServiceList
        services={[
          service(1, { priceMinor: null, description: "service 1" }),
          service(2, { priceMinor: 0 }),
        ]}
        currency="DOP"
        slug="test"
        bookable={false}
      />
    )
    expect(screen.getByText("Free")).toBeTruthy()
    expect(screen.queryByText(/Price varies/)).toBeNull()
    expect(screen.queryByText(/· service 1/)).toBeNull()
  })
})
