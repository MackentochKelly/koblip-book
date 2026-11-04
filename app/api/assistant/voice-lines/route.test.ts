// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/features/dashboard/api/owned-business", () => ({
  ownedBusiness: vi.fn(),
}))
vi.mock("@/features/assistant/api/rate-limit", () => ({
  checkAssistantRateLimit: vi.fn(() => true),
}))
vi.mock("@/features/dashboard/i18n/server", () => ({
  getOwnerLanguage: vi.fn(async () => "es"),
}))
vi.mock("@/features/assistant/api/voice-lines", () => ({
  writeGreeting: vi.fn(),
  writeCutIns: vi.fn(),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { writeGreeting, writeCutIns } =
  await import("@/features/assistant/api/voice-lines")
const { POST } = await import("./route")

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/assistant/voice-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ userId: "u1" } as never)
  vi.mocked(ownedBusiness).mockResolvedValue({
    business: { id: "b1", name: "Salon", timezone: "Europe/Madrid" },
  } as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(writeGreeting).mockReset()
  vi.mocked(writeCutIns).mockReset()
})

test("the hello, in the owner's language from the cookie, never the body", async () => {
  vi.mocked(writeGreeting).mockResolvedValue("Hola")
  const res = await post({ businessId: "b1", part: "greeting", language: "en" })
  expect(await res.json()).toEqual({ greeting: "Hola" })
  expect(vi.mocked(writeGreeting).mock.calls[0][0]).toMatchObject({
    businessName: "Salon",
    language: "es",
  })
  expect(writeCutIns).not.toHaveBeenCalled()
})

test("the cut-in words", async () => {
  const lines = { cutIns: ["Mira,"] }
  vi.mocked(writeCutIns).mockResolvedValue(lines)
  const res = await post({ businessId: "b1", part: "cutIns" })
  expect(await res.json()).toEqual(lines)
  expect(writeGreeting).not.toHaveBeenCalled()
})

test("503 when the AI could not write them", async () => {
  vi.mocked(writeGreeting).mockResolvedValue(null)
  vi.mocked(writeCutIns).mockResolvedValue(null)
  expect((await post({ businessId: "b1", part: "greeting" })).status).toBe(503)
  expect((await post({ businessId: "b1", part: "cutIns" })).status).toBe(503)
})

test("guards: logged out, rate limited, bad body, another owner's business", async () => {
  vi.mocked(getSession).mockResolvedValueOnce(null as never)
  expect((await post({ businessId: "b1", part: "greeting" })).status).toBe(401)
  vi.mocked(checkAssistantRateLimit).mockReturnValueOnce(false)
  expect((await post({ businessId: "b1", part: "greeting" })).status).toBe(429)
  expect((await post({ businessId: 1, part: "greeting" })).status).toBe(400)
  expect((await post({ businessId: "b1", part: "other" })).status).toBe(400)
  vi.mocked(ownedBusiness).mockResolvedValueOnce(null as never)
  expect((await post({ businessId: "b2", part: "greeting" })).status).toBe(403)
  expect(writeGreeting).not.toHaveBeenCalled()
})

test("a cross-site request is refused", async () => {
  const res = await post(
    { businessId: "b1", part: "greeting" },
    { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }
  )
  expect(res.status).toBe(403)
})
