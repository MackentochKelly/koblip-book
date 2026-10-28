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
vi.mock("@/features/assistant/api/transcribe", () => ({
  transcribeVoice: vi.fn(),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { getOwnerLanguage } = await import("@/features/dashboard/i18n/server")
const { transcribeVoice } = await import("@/features/assistant/api/transcribe")
const { POST } = await import("./route")
const { ASSISTANT_RULES } = await import("@/lib/assistant-rules")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const BUSINESS = { id: "b1", name: "Salon" }

function post(body?: BodyInit, origin?: string) {
  const headers: Record<string, string> = {}
  if (origin !== undefined) {
    headers.origin = origin
  }
  return new Request("http://localhost/api/assistant/transcribe", {
    method: "POST",
    headers,
    body,
  })
}

function form(extra?: Record<string, string>) {
  const form = new FormData()
  form.set("businessId", "b1")
  form.set("audio", new File([new Uint8Array([1, 2, 3])], "a.wav"))
  for (const [key, value] of Object.entries(extra ?? {})) {
    form.set(key, value)
  }
  return form
}

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockResolvedValue({
    business: BUSINESS,
    userId: "u1",
  } as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(getOwnerLanguage).mockResolvedValue("en")
  vi.mocked(transcribeVoice).mockClear()
  vi.mocked(transcribeVoice).mockResolvedValue({ text: "hello" })
})

test("refuses a cross-site origin", async () => {
  const res = await POST(post(form(), "https://evil.com"))
  expect(res.status).toBe(403)
  expect(transcribeVoice).not.toHaveBeenCalled()
})

test("answers 401 when not logged in", async () => {
  vi.mocked(getSession).mockResolvedValue(null)
  const res = await POST(post(form()))
  expect(res.status).toBe(401)
  expect(transcribeVoice).not.toHaveBeenCalled()
})

test("rate limited answers rate_limited on its own key", async () => {
  vi.mocked(checkAssistantRateLimit).mockReturnValue(false)
  const res = await POST(post(form()))
  expect(await res.json()).toEqual({ error: "rate_limited" })
  expect(checkAssistantRateLimit).toHaveBeenCalledWith(
    "transcribe:u1",
    ASSISTANT_RULES.maxTranscribesPerMinutePerOwner
  )
  expect(transcribeVoice).not.toHaveBeenCalled()
})

test("malformed body answers bad_request", async () => {
  const res = await POST(post("not-a-form"))
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: "bad_request" })
  expect(transcribeVoice).not.toHaveBeenCalled()
})

test("missing audio answers bad_request", async () => {
  const empty = new FormData()
  empty.set("businessId", "b1")
  const res = await POST(post(empty))
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: "bad_request" })
})

test("oversized audio answers too_long before reading", async () => {
  const big = new FormData()
  big.set("businessId", "b1")
  big.set(
    "audio",
    new File(
      [new Uint8Array(ASSISTANT_RULES.maxTranscribeBytes + 1)],
      "big.wav"
    )
  )
  const res = await POST(post(big))
  expect(await res.json()).toEqual({ error: "too_long" })
  expect(ownedBusiness).not.toHaveBeenCalled()
  expect(transcribeVoice).not.toHaveBeenCalled()
})

test("wrong owner answers not_allowed", async () => {
  vi.mocked(ownedBusiness).mockResolvedValue(null)
  const res = await POST(post(form()))
  expect(await res.json()).toEqual({ error: "not_allowed" })
  expect(transcribeVoice).not.toHaveBeenCalled()
})

test("good case returns only text", async () => {
  const res = await POST(post(form()))
  expect(await res.json()).toEqual({ text: "hello" })
})

test("language comes from the cookie, never the body", async () => {
  vi.mocked(getOwnerLanguage).mockResolvedValue("es")
  const res = await POST(post(form({ lang: "en" })))
  expect(await res.json()).toEqual({ text: "hello" })
  expect(vi.mocked(transcribeVoice).mock.calls[0]?.[1]).toBe("es")
})

test("empty_audio passes through", async () => {
  vi.mocked(transcribeVoice).mockResolvedValue({ code: "empty_audio" })
  const res = await POST(post(form()))
  expect(await res.json()).toEqual({ error: "empty_audio" })
})
