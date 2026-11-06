import { expect, test } from "vitest"
import { groupServices, inGroupOrder, showsGroups } from "./service-groups"

const hair = { id: "hair", name: "Hair" }
const nails = { id: "nails", name: "Nails" }
const face = { id: "face", name: "Face" }

const cut = { id: "cut", categoryId: "hair" }
const colour = { id: "colour", categoryId: "hair" }
const manicure = { id: "manicure", categoryId: "nails" }
const loose = { id: "loose", categoryId: null }
const orphan = { id: "orphan", categoryId: "gone" }

test("categories in their order, then Other with no category or a lost one", () => {
  const groups = groupServices(
    [loose, cut, manicure, orphan, colour],
    [nails, hair]
  )
  expect(groups.map((group) => group.category?.id ?? "other")).toEqual([
    "nails",
    "hair",
    "other",
  ])
  expect(groups[1].services).toEqual([cut, colour])
  expect(groups[2].services).toEqual([loose, orphan])
  expect(inGroupOrder(groups).map((service) => service.id)).toEqual([
    "manicure",
    "cut",
    "colour",
    "loose",
    "orphan",
  ])
  expect(showsGroups(groups)).toBe(true)
})

test("an empty category shows only on the owner's screen", () => {
  expect(groupServices([cut], [hair, face]).map((g) => g.category?.id)).toEqual([
    "hair",
  ])
  expect(
    groupServices([cut], [hair, face], { keepEmpty: true }).map(
      (g) => g.category?.id
    )
  ).toEqual(["hair", "face"])
})

test("no categories: one flat list, not shown as groups", () => {
  const groups = groupServices([cut, loose], [])
  expect(groups).toEqual([{ category: null, services: [cut, loose] }])
  expect(showsGroups(groups)).toBe(false)
  expect(groupServices([], [])).toEqual([])
})
