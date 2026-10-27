// @vitest-environment node
import { expect, test } from "vitest"
import { checkAddons, type CheckAddonGroup } from "./addons"

const groups: CheckAddonGroup[] = [
  {
    id: "g1",
    minSelect: 1,
    maxSelect: 2,
    options: [
      { id: "o1", name: "A", priceMinor: 500, durationMinutes: 15 },
      { id: "o2", name: "B", priceMinor: null, durationMinutes: 0 },
      { id: "o3", name: "C", priceMinor: 200, durationMinutes: 5 },
    ],
  },
  {
    id: "g2",
    minSelect: 0,
    maxSelect: null,
    options: [
      { id: "o4", name: "D", priceMinor: null, durationMinutes: 10 },
      { id: "o5", name: "E", priceMinor: 100, durationMinutes: 0 },
    ],
  },
]

test("accepts a valid pick and returns options in group then option order", () => {
  const result = checkAddons(groups, ["o5", "o3", "o1"])
  expect(result).toEqual({
    ok: true,
    options: [
      { id: "o1", name: "A", priceMinor: 500, durationMinutes: 15 },
      { id: "o3", name: "C", priceMinor: 200, durationMinutes: 5 },
      { id: "o5", name: "E", priceMinor: 100, durationMinutes: 0 },
    ],
    extraMinutes: 20,
    extraPriceMinor: 800,
  })
})

test("null option prices count as 0 unless every pick is free", () => {
  const allFree = checkAddons(groups, ["o2", "o4"])
  expect(allFree).toEqual({
    ok: true,
    options: [
      { id: "o2", name: "B", priceMinor: null, durationMinutes: 0 },
      { id: "o4", name: "D", priceMinor: null, durationMinutes: 10 },
    ],
    extraMinutes: 10,
    extraPriceMinor: null,
  })
  const mixed = checkAddons(groups, ["o1", "o2"])
  expect(mixed.ok).toBe(true)
  if (mixed.ok) {
    expect(mixed.extraPriceMinor).toBe(500)
    expect(mixed.extraMinutes).toBe(15)
  }
})

test("empty pick is fine when every group is optional", () => {
  const optional: CheckAddonGroup[] = [
    { id: "g", minSelect: 0, maxSelect: null, options: [] },
  ]
  expect(checkAddons(optional, [])).toEqual({
    ok: true,
    options: [],
    extraMinutes: 0,
    extraPriceMinor: null,
  })
})

test("rejects picks below minSelect or above maxSelect", () => {
  // g1 needs at least 1.
  expect(checkAddons(groups, ["o4"])).toEqual({ ok: false })
  // g1 allows at most 2.
  expect(checkAddons(groups, ["o1", "o2", "o3"])).toEqual({ ok: false })
  // g2 has no upper limit.
  const many: CheckAddonGroup[] = [
    {
      id: "g2",
      minSelect: 0,
      maxSelect: null,
      options: Array.from({ length: 10 }, (_, i) => ({
        id: `x${i}`,
        name: `X${i}`,
        priceMinor: null as number | null,
        durationMinutes: 0,
      })),
    },
  ]
  const result = checkAddons(
    many,
    many[0].options.map((option) => option.id)
  )
  expect(result.ok).toBe(true)
})

test("rejects unknown ids, duplicates and non-arrays", () => {
  expect(checkAddons(groups, ["o1", "nope"])).toEqual({ ok: false })
  expect(checkAddons(groups, ["o1", "o1"])).toEqual({ ok: false })
  expect(checkAddons(groups, "o1" as unknown as string[])).toEqual({
    ok: false,
  })
})

test("rejects options from a group that is not linked to the service", () => {
  const linkedOnly = [groups[0]]
  expect(checkAddons(linkedOnly, ["o1", "o4"])).toEqual({ ok: false })
  expect(checkAddons(linkedOnly, ["o1"])).toEqual({
    ok: true,
    options: [
      { id: "o1", name: "A", priceMinor: 500, durationMinutes: 15 },
    ],
    extraMinutes: 15,
    extraPriceMinor: 500,
  })
})
