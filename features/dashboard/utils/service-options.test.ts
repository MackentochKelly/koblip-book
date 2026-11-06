import { expect, test } from "vitest"
import { serviceSelectOptions } from "./service-options"

const services = [
  { id: "s1", name: "Manicure", categoryId: "nails" },
  { id: "s2", name: "Consult", categoryId: null },
  { id: "s3", name: "Fade", categoryId: "hair" },
  { id: "s4", name: "Pedicure", categoryId: "nails" },
  { id: "s5", name: "Old", categoryId: "gone" },
]
const categories = [
  { id: "hair", name: "Hair" },
  { id: "empty", name: "Empty" },
  { id: "nails", name: "Nails" },
]

test("no categories: the flat list in the saved order, no labels", () => {
  const flat = services.map((service) => ({ ...service, categoryId: null }))
  const expected = flat.map((service) => ({
    value: service.id,
    label: service.name,
    group: undefined,
  }))
  expect(serviceSelectOptions(flat, [], "Other")).toEqual(expected)
  // Categories with no service in them change nothing either.
  expect(serviceSelectOptions(flat, categories, "Other")).toEqual(expected)
})

test("categories in their order, empty ones left out, Other last", () => {
  expect(
    serviceSelectOptions(services, categories, "Other").map(
      ({ value, group }) => [value, group]
    )
  ).toEqual([
    ["s3", "Hair"],
    ["s1", "Nails"],
    ["s4", "Nails"],
    // No category, or one that is gone.
    ["s2", "Other"],
    ["s5", "Other"],
  ])
})

test("each option's own label", () => {
  const [first] = serviceSelectOptions(
    services,
    categories,
    "Otros",
    (service) => `${service.name} · 30 min`
  )
  expect(first).toEqual({ value: "s3", label: "Fade · 30 min", group: "Hair" })
})
