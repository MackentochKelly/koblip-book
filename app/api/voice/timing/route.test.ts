// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/features/dashboard/api/owned-business", () => ({
  ownedBusiness: vi.fn(),
}))
vi.mock("@/features/assistant/api/rate-limit", () => ({
  checkAssistantRateLimit: vi.fn(() => true),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { POST } = await import("./route")

const GOOD = {
  businessId: "b1",
  how: "early",
  heardMs: 612.4,
  firstWordsMs: 1200,
  firstSoundMs: 1400,
}
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/voice/timing", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ userId: "u1" } as never)
  vi.mocked(ownedBusiness).mockResolvedValue({
    business: { id: "b1" },
  } as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

test("logs the numbers, and nothing else that was sent", async () => {
  const res = await post({ ...GOOD, words: "private words" })
  expect(res.status).toBe(204)
  expect(console.info).toHaveBeenCalledWith(
    "voice-timing",
    JSON.stringify({
      how: "early",
      heardMs: 612,
      firstWordsMs: 1200,
      firstSoundMs: 1400,
      totalMs: 2012,
    })
  )
})

test("guards: logged out, rate limited, bad body, another owner's business", async () => {
  vi.mocked(getSession).mockResolvedValueOnce(null as never)
  expect((await post(GOOD)).status).toBe(401)
  vi.mocked(checkAssistantRateLimit).mockReturnValueOnce(false)
  expect((await post(GOOD)).status).toBe(429)
  expect((await post({ ...GOOD, how: "other" })).status).toBe(400)
  expect((await post({ ...GOOD, heardMs: -1 })).status).toBe(400)
  expect((await post({ ...GOOD, firstSoundMs: "1" })).status).toBe(400)
  vi.mocked(ownedBusiness).mockResolvedValueOnce(null as never)
  expect((await post(GOOD)).status).toBe(403)
  expect(console.info).not.toHaveBeenCalled()
})

test("another site can't report", async () => {
  const res = await post(GOOD, {
    Origin: "https://evil.example",
    Host: "localhost",
  })
  expect(res.status).toBe(403)
})
