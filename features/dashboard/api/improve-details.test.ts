// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
// Every feature is in the plan here (lib/plan-access.ts is tested on its own).
vi.mock("@/lib/plan-access", () => ({ hasFeature: vi.fn(async () => true) }))

const { createMock, ownedMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  ownedMock: vi.fn(),
}))

vi.mock("openai", () => ({
  default: vi.fn(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  }),
}))
vi.mock("./owned-business", () => ({ ownedBusiness: ownedMock }))

const { improveDetails } = await import("./improve-details")

const reply = (payload: unknown) => ({
  choices: [{ message: { content: JSON.stringify(payload) } }],
})

beforeEach(() => {
  vi.stubEnv("MODEL_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
  createMock.mockReset()
  ownedMock.mockReset()
  ownedMock.mockResolvedValue({
    business: { category: "Barber shop", address: "Santo Domingo" },
    userId: "u1",
  })
})

test("returns the tidied name and the new About, saving nothing", async () => {
  createMock.mockResolvedValue(
    reply({ name: "Barbershop Near Me", about: "A friendly barbershop in Santo Domingo. Book your cut today." })
  )
  expect(
    await improveDetails("b1", { name: "BARBERSHOP NEAR ME™", description: null })
  ).toEqual({
    ok: true,
    name: "Barbershop Near Me",
    description: "A friendly barbershop in Santo Domingo. Book your cut today.",
  })
  expect(createMock.mock.calls[0][0].messages[1].content).toContain("Current About: none")
})

test("keeps the typed name when Muse renames the business", async () => {
  createMock.mockResolvedValue(reply({ name: "Elite Cuts Studio", about: "Fresh cuts. Book now." }))
  const result = await improveDetails("b1", { name: "BARBERSHOP NEAR ME™", description: "Old" })
  expect(result.ok && result.name).toBe("BARBERSHOP NEAR ME™")
})

test("refuses someone else's business, empty names and a failed answer", async () => {
  ownedMock.mockResolvedValueOnce(null)
  expect(await improveDetails("b1", { name: "X", description: null })).toEqual({ ok: false, error: "not_found" })
  expect(await improveDetails("b1", { name: " ", description: null })).toEqual({ ok: false, error: "invalid" })
  createMock.mockRejectedValue(new Error("down"))
  expect(await improveDetails("b1", { name: "Shop", description: null })).toEqual({ ok: false, error: "failed" })
})
