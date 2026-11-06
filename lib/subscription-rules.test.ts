import { describe, expect, it } from "vitest"

import { isPlan, PLANS } from "./plan-features"
import { PAID_PLANS } from "./subscription-rules"

describe("PAID_PLANS", () => {
  it("sells only plans the app knows, never the free one", () => {
    for (const plan of PAID_PLANS) {
      expect(isPlan(plan.name)).toBe(true)
      expect(plan.name).not.toBe(PLANS[0])
    }
  })
})
