import { describe, expect, it } from "vitest"

import { isPlan, PLANS } from "./plan-features"
import { PAID_PLANS, stopsAt } from "./subscription-rules"

describe("PAID_PLANS", () => {
  it("sells only plans the app knows, never the free one", () => {
    for (const plan of PAID_PLANS) {
      expect(isPlan(plan.name)).toBe(true)
      expect(plan.name).not.toBe(PLANS[0])
    }
  })
})

describe("stopsAt", () => {
  const periodEnd = new Date("2026-12-07T00:00:00Z")

  it("gives no date for a subscription that renews", () => {
    expect(stopsAt({ cancelAtPeriodEnd: false, cancelAt: null, periodEnd })).toBeNull()
  })

  it("stops at the period's end when cancel_at_period_end is set", () => {
    expect(stopsAt({ cancelAtPeriodEnd: true, cancelAt: null, periodEnd })).toEqual(periodEnd)
  })

  it("stops on cancel_at, which the portal sets in the newer billing mode", () => {
    expect(stopsAt({ cancelAtPeriodEnd: false, cancelAt: periodEnd, periodEnd: null })).toEqual(
      periodEnd
    )
  })
})
