import { describe, expect, it } from "vitest"

import {
  DEFAULT_LAYOUT,
  normalizeLayout,
  reorderShown,
  setShown,
  shownWidgets,
} from "./widget-layout"

describe("normalizeLayout", () => {
  it("starts a new business with the default", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(normalizeLayout("bad")).toEqual(DEFAULT_LAYOUT)
    expect(shownWidgets(DEFAULT_LAYOUT)).toEqual(["stats", "today", "bookings"])
  })

  it("keeps the owner's order and drops unknown or repeated widgets", () => {
    const layout = normalizeLayout({
      order: ["bookings", "nope", "stats", "bookings"],
      hidden: ["stats", "nope"],
    })
    expect(layout.order.slice(0, 2)).toEqual(["bookings", "stats"])
    expect(layout.order).toHaveLength(DEFAULT_LAYOUT.order.length)
    expect(layout.hidden).toContain("stats")
    expect(layout.hidden).not.toContain("today")
  })

  it("adds a widget new to the app at the end, as it starts", () => {
    const layout = normalizeLayout({ order: ["today", "stats"], hidden: [] })
    expect(layout.order.slice(0, 2)).toEqual(["today", "stats"])
    expect(layout.hidden).toEqual(["next", "chart", "newCustomers", "share"])
    expect(shownWidgets(layout)).toEqual(["today", "stats", "bookings"])
  })
})

describe("reorderShown and setShown", () => {
  it("moves shown widgets and leaves taken-off ones in place", () => {
    const layout = {
      order: ["stats", "next", "today", "bookings"],
      hidden: ["next"],
    } as const
    const moved = reorderShown(
      { order: [...layout.order], hidden: [...layout.hidden] },
      ["bookings", "stats", "today"]
    )
    expect(moved.order).toEqual(["bookings", "next", "stats", "today"])
  })

  it("takes a widget off and puts it back", () => {
    const off = setShown(DEFAULT_LAYOUT, "stats", false)
    expect(shownWidgets(off)).toEqual(["today", "bookings"])
    expect(shownWidgets(setShown(off, "stats", true))).toEqual([
      "stats",
      "today",
      "bookings",
    ])
  })
})
