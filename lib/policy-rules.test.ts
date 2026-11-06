import { expect, test } from "vitest"

import { orderPolicies, policySegment } from "./policy-rules"

test("orders the standard policies first, then the owner's own by age", () => {
  const rows = [
    { id: "b", kind: null, createdAt: "2026-11-02" },
    { id: "t", kind: "terms", createdAt: "2026-11-03" },
    { id: "a", kind: null, createdAt: "2026-11-01" },
    { id: "k", kind: "booking", createdAt: "2026-11-04" },
  ] as const
  expect(orderPolicies(rows).map((row) => row.id)).toEqual(["k", "t", "a", "b"])
})

test("a standard policy's address is its kind; the owner's own, its id", () => {
  expect(policySegment({ id: "p1", kind: "privacy" })).toBe("privacy")
  expect(policySegment({ id: "p2", kind: null })).toBe("p2")
})
