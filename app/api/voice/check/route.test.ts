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
  getOwnerLanguage: vi.fn(async () => "en"),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { getOwnerLanguage } =
  await import("@/features/dashboard/i18n/server")
const { GET } = await import("./route")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const URL = "http://localhost/api/voice/check?businessId=b1"

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockImplementation(async (businessId: string) =>
    businessId === "b1" ? ({ business: { id: "b1" } } as never) : null
  )
  vi.mocked(getOwnerLanguage).mockResolvedValue("en")
})

test("401 without a session", async () => {
  vi.mocked(getSession).mockResolvedValue(null)
  const res = await GET(new Request(URL))
  expect(res.status).toBe(401)
})

test("429 over the limit", async () => {
  vi.mocked(checkAssistantRateLimit).mockReturnValue(false)
  const res = await GET(new Request(URL))
  expect(res.status).toBe(429)
  expect(checkAssistantRateLimit).toHaveBeenCalledWith("voice:u1", 6)
})

test("404 for another owner's business", async () => {
  const res = await GET(
    new Request("http://localhost/api/voice/check?businessId=other")
  )
  expect(res.status).toBe(404)
})

test("404 without a businessId", async () => {
  const res = await GET(new Request("http://localhost/api/voice/check"))
  expect(res.status).toBe(404)
})

test("200 with the English handshake and limits, never a key", async () => {
  const res = await GET(new Request(URL))
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body).toEqual({
    handshake: {
      audioEncoding: "PCM_24KHZ",
      model: "muse-voice-transcribe-1.0",
      mode: "ENDPOINTING",
      partialMode: "CUMULATIVE",
      languageBias: ["English"],
    },
    maxSessionSeconds: 600,
    maxBufferedBytes: 240_000,
    maxFrameBytes: 9_600,
  })
  expect(JSON.stringify(body)).not.toMatch(/Bearer|MODEL_API_KEY/i)
})

test("Spanish owners bias toward Spanish", async () => {
  vi.mocked(getOwnerLanguage).mockResolvedValue("es")
  const res = await GET(new Request(URL))
  const body = await res.json()
  expect(body.handshake.languageBias).toEqual(["Spanish"])
})
