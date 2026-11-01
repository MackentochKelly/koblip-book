import { expect, test } from "vitest"
import { checkCatalog } from "./check-catalog"

const item = (name: string, durationMinutes = 30, price = 20) => ({
  name,
  description: `${name}, done well.`,
  durationMinutes,
  price,
})

const good = () => ({
  services: [item("Haircut"), item("Beard trim", 20, 12), item("Kids cut"), item("Hot towel shave", 45, 25.5)],
  extras: {
    name: "Add-ons",
    prompt: "Anything else?",
    options: [item("Hair wash", 10, 5), item("Eyebrow tidy", 5, 4), item("Face mask", 15, 8)],
  },
  team: {
    role: "Barber",
    members: [
      { name: "Luis", description: "Skin fades." },
      { name: "Ana", description: "Classic cuts." },
      { name: "Marco", description: "Beards and shaves." },
    ],
  },
})

test("passes a good catalog and turns prices into minor units", () => {
  const check = checkCatalog(good())
  expect(check.ok).toBe(true)
  if (!check.ok) return
  expect(check.catalog.services[3]).toMatchObject({ name: "Hot towel shave", priceMinor: 2550 })
  expect(check.catalog.extras.options[0].priceMinor).toBe(500)
  expect(check.catalog.team.members).toHaveLength(3)
})

test("snaps lengths to ones the booking page offers", () => {
  const draft = good()
  draft.services[0].durationMinutes = 35
  draft.extras.options[0].durationMinutes = 12
  const check = checkCatalog(draft)
  expect(check.ok && check.catalog.services[0].durationMinutes).toBe(30)
  expect(check.ok && check.catalog.extras.options[0].durationMinutes).toBe(10)
})

test("lists every problem so the model can fix them", () => {
  const draft = good()
  draft.services = draft.services.slice(0, 2)
  draft.services[1].price = 0
  draft.extras.options[0].name = "Haircut"
  draft.team.members.pop()
  const check = checkCatalog(draft)
  expect(check.ok).toBe(false)
  if (check.ok) return
  expect(check.problems).toEqual(
    expect.arrayContaining([
      "Give 4 to 6 services, not 2.",
      "services 2: price must be a positive amount in the local currency.",
      'Extra "Haircut" is also a service; extras must be different.',
      "Give exactly 3 team members, not 2.",
    ])
  )
})

test("rejects repeats and an answer that is not a catalog", () => {
  const draft = good()
  draft.services[1].name = "haircut"
  const repeat = checkCatalog(draft)
  expect(!repeat.ok && repeat.problems).toContain('services 2: "haircut" is listed twice.')
  expect(checkCatalog(null).ok).toBe(false)
  expect(checkCatalog("nonsense").ok).toBe(false)
})
