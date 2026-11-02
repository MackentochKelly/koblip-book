import { describe, expect, it } from "vitest"

import { partOfDay } from "./part-of-day"

describe("partOfDay", () => {
  it("follows the business's clock", () => {
    const now = new Date("2026-11-01T15:30:00Z")
    expect(partOfDay("UTC", 18, now)).toBe("afternoon")
    expect(partOfDay("America/New_York", 18, now)).toBe("morning")
    expect(partOfDay("Asia/Dubai", 18, now)).toBe("evening")
  })

  it("turns at noon and the evening hour", () => {
    expect(partOfDay("UTC", 18, new Date("2026-11-01T00:00:00Z"))).toBe(
      "morning"
    )
    expect(partOfDay("UTC", 18, new Date("2026-11-01T11:59:00Z"))).toBe(
      "morning"
    )
    expect(partOfDay("UTC", 18, new Date("2026-11-01T12:00:00Z"))).toBe(
      "afternoon"
    )
    expect(partOfDay("UTC", 18, new Date("2026-11-01T18:00:00Z"))).toBe(
      "evening"
    )
  })

  it("lets a language keep the afternoon longer", () => {
    const sevenPm = new Date("2026-11-01T19:00:00Z")
    expect(partOfDay("UTC", 18, sevenPm)).toBe("evening")
    expect(partOfDay("UTC", 20, sevenPm)).toBe("afternoon")
  })
})
