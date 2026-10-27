import { describe, expect, it } from "vitest"
import type { BusinessHour } from "../types"
import { isOpenNow } from "./is-open-now"

const row = (weekday: number, opensAt: string, closesAt: string) =>
  ({ id: `${weekday}-${opensAt}`, businessId: "b", weekday, opensAt, closesAt }) as BusinessHour

// Monday 2026-10-26 in UTC.
const at = (time: string) => new Date(`2026-10-26T${time}:00Z`)

describe("isOpenNow", () => {
  const hours = [row(1, "09:00", "13:00"), row(1, "15:00", "19:00")]

  it("is open inside a range", () => {
    expect(isOpenNow(hours, "UTC", at("10:00"))).toBe(true)
  })

  it("is closed between ranges and at closing time", () => {
    expect(isOpenNow(hours, "UTC", at("14:00"))).toBe(false)
    expect(isOpenNow(hours, "UTC", at("19:00"))).toBe(false)
  })

  it("keeps an overnight range open after midnight", () => {
    expect(isOpenNow([row(0, "20:00", "02:00")], "UTC", at("01:00"))).toBe(true)
    expect(isOpenNow([row(0, "20:00", "02:00")], "UTC", at("03:00"))).toBe(false)
  })

  it("uses the business's time zone", () => {
    // 10:00 UTC is 06:00 in Santo Domingo.
    expect(isOpenNow(hours, "America/Santo_Domingo", at("10:00"))).toBe(false)
  })
})
