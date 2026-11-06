// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
// Every feature is in the plan here (lib/plan-access.ts is tested on its own).
vi.mock("@/lib/plan-access", () => ({ hasFeature: vi.fn(async () => true) }))
vi.mock("@/lib/account-voices", () => ({ getOwnerVoiceId: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/features/dashboard/api/owned-business", () => ({
  ownedBusiness: vi.fn(),
}))
vi.mock("@/features/assistant/api/rate-limit", () => ({
  checkAssistantRateLimit: vi.fn(() => true),
}))

const { getOwnerVoiceId } = await import("@/lib/account-voices")
const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { GET } = await import("./route")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const ROUTE_URL = "http://localhost/api/voice/speak-token?businessId=b1"

function get(headers: Record<string, string> = {}) {
  return new Request(ROUTE_URL, { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getOwnerVoiceId).mockResolvedValue("saved-voice")
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockImplementation(async (businessId: string) =>
    businessId === "b1" ? ({ business: { id: "b1" } } as never) : null
  )
  process.env.ELEVENLABS_API_KEY = "test-key"
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ token: "tok" }) }))
  )
  return () => {
    vi.unstubAllGlobals()
  }
})

test("403 for a cross-site origin", async () => {
  const res = await GET(get({ origin: "https://evil.com" }))
  expect(res.status).toBe(403)
})

test("401 without a session", async () => {
  vi.mocked(getSession).mockResolvedValue(null)
  expect((await GET(get())).status).toBe(401)
})

test("429 over the limit", async () => {
  vi.mocked(checkAssistantRateLimit).mockReturnValue(false)
  const res = await GET(get())
  expect(res.status).toBe(429)
  expect(checkAssistantRateLimit).toHaveBeenCalledWith("speak:u1", 30)
})

test("404 for another owner's business", async () => {
  const res = await GET(
    new Request("http://localhost/api/voice/speak-token?businessId=other")
  )
  expect(res.status).toBe(404)
})

test("503 without the key", async () => {
  delete process.env.ELEVENLABS_API_KEY
  const res = await GET(get())
  expect(res.status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
})

test("502 when ElevenLabs fails, without their body", async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: false,
    json: async () => ({ detail: "secret backend words" }),
  } as never)
  const res = await GET(get())
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ error: "unavailable" })
})

test("502 when the mint shape is wrong", async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as never)
  const res = await GET(get())
  expect(res.status).toBe(502)
})

test("200 mints with the proven type and returns url plus voiceId", async () => {
  const { VOICE_RULES } = await import("@/lib/voice-rules")
  const res = await GET(get())
  expect(res.status).toBe(200)
  // No typed copies: every literal below comes from VOICE_RULES.
  expect(fetch).toHaveBeenCalledWith(
    `${VOICE_RULES.speakTokenUrl}${VOICE_RULES.speakTokenType}`,
    { method: "POST", headers: { "xi-api-key": "test-key" } }
  )
  expect(VOICE_RULES.speakTokenType).toBe("ttd_websocket")
  const body = await res.json()
  expect(body).toEqual({
    url:
      `${VOICE_RULES.speakSocketUrl}` +
      `?model_id=${VOICE_RULES.speakModel}` +
      `&output_format=${VOICE_RULES.speakOutputFormat}` +
      `&sync_alignment=${VOICE_RULES.speakSyncAlignment}` +
      `&single_use_token=tok`,
    voiceId: "saved-voice",
  })
  expect(VOICE_RULES.speakSyncAlignment).toBe(true)
  expect(VOICE_RULES.speakSampleRate).toBe(24000)
  expect(VOICE_RULES.maxSpeakTokensPerMinutePerOwner).toBe(30)
  expect(JSON.stringify(body)).not.toContain("test-key")
})

test("a token needing encoding round-trips through the URL", async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ token: "a+b/c=" }),
  } as never)
  const res = await GET(get())
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(new URL(body.url).searchParams.get("single_use_token")).toBe("a+b/c=")
})

test("409 without a chosen voice, with no token minted", async () => {
  vi.mocked(getOwnerVoiceId).mockResolvedValue(null)
  const res = await GET(get())
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ error: "no_voice" })
  expect(fetch).not.toHaveBeenCalled()
  expect(getOwnerVoiceId).toHaveBeenCalledExactlyOnceWith(OWNER.userId)
})

test("the browser's voice id is ignored in favor of the owner's choice", async () => {
  const res = await GET(new Request(ROUTE_URL + "&voiceId=browser-voice"))
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ voiceId: "saved-voice" })
  expect(getOwnerVoiceId).toHaveBeenCalledExactlyOnceWith(OWNER.userId)
})

test("demo guests use their own saved voice too", async () => {
  vi.mocked(getSession).mockResolvedValue({ ...OWNER, userId: "guest", isGuest: true } as never)
  vi.mocked(getOwnerVoiceId).mockResolvedValue("guest-voice")
  const res = await GET(get())
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ voiceId: "guest-voice" })
  expect(getOwnerVoiceId).toHaveBeenCalledWith("guest")
})
