import { describe, expect, it } from "vitest"

import { partOfDay } from "./part-of-day"

describe("partOfDay", () => {
  it("follows the business's clock", () => {
    const now = new Date("2026-11-01T15:30:00Z")
    expect(partOfDay("UTC", now)).toBe("afternoon")
    expect(partOfDay("America/New_York", now)).toBe("morning")
    expect(partOfDay("Asia/Tokyo", now)).toBe("morning")
    expect(partOfDay("Asia/Dubai", now)).toBe("evening")
  })

  it("turns at noon and 6pm", () => {
    expect(partOfDay("UTC", new Date("2026-11-01T00:00:00Z"))).toBe("morning")
    expect(partOfDay("UTC", new Date("2026-11-01T11:59:00Z"))).toBe("morning")
    expect(partOfDay("UTC", new Date("2026-11-01T12:00:00Z"))).toBe("afternoon")
    expect(partOfDay("UTC", new Date("2026-11-01T18:00:00Z"))).toBe("evening")
    expect(partOfDay("UTC", new Date("2026-11-01T23:59:00Z"))).toBe("evening")
  })
})
