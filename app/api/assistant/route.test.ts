// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/features/dashboard/api/owned-business", () => ({
  ownedBusiness: vi.fn(),
}))
vi.mock("@/features/assistant/api/run-chat", () => ({
  runChat: vi.fn(),
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
const { runChat } = await import("@/features/assistant/api/run-chat")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { getOwnerLanguage } = await import("@/features/dashboard/i18n/server")
const { POST } = await import("./route")
const { ASSISTANT_RULES } = await import("@/lib/assistant-rules")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const BUSINESS = { id: "b1", name: "Salon" }

function post(body: unknown, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin !== undefined) {
    headers.origin = origin
  }
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

async function events(res: Response) {
  const text = await res.text()
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line))
}

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockResolvedValue({
    business: BUSINESS,
    userId: "u1",
  } as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(getOwnerLanguage).mockResolvedValue("en")
  vi.mocked(runChat).mockImplementation(async function* () {
    yield { type: "text", delta: "hi" }
    yield { type: "done" }
  } as never)
})

test("refuses a cross-site origin", async () => {
  const res = await POST(
    post(
      { businessId: "b1", messages: [{ role: "owner", text: "hi" }] },
      "https://evil.com"
    )
  )
  expect(res.status).toBe(403)
  expect(runChat).not.toHaveBeenCalled()
})

test("answers 401 when not logged in", async () => {
  vi.mocked(getSession).mockResolvedValue(null)
  const res = await POST(
    post({ businessId: "b1", messages: [{ role: "owner", text: "hi" }] })
  )
  expect(res.status).toBe(401)
})

test("wrong owner gives not_allowed and calls nothing", async () => {
  vi.mocked(ownedBusiness).mockResolvedValue(null)
  const res = await POST(
    post({ businessId: "b1", messages: [{ role: "owner", text: "hi" }] })
  )
  expect(await events(res)).toEqual([{ type: "error", code: "not_allowed" }])
  expect(runChat).not.toHaveBeenCalled()
})

test("too long gives too_long and calls nothing", async () => {
  const long = "x".repeat(ASSISTANT_RULES.maxMessageChars + 1)
  const res = await POST(
    post({ businessId: "b1", messages: [{ role: "owner", text: long }] })
  )
  expect(await events(res)).toEqual([{ type: "error", code: "too_long" }])
  expect(runChat).not.toHaveBeenCalled()
})

test("rate limited gives rate_limited and calls nothing", async () => {
  vi.mocked(checkAssistantRateLimit).mockReturnValue(false)
  const res = await POST(
    post({ businessId: "b1", messages: [{ role: "owner", text: "hi" }] })
  )
  expect(await events(res)).toEqual([{ type: "error", code: "rate_limited" }])
  expect(runChat).not.toHaveBeenCalled()
})

test("model failure streams unavailable", async () => {
  vi.mocked(runChat).mockImplementation(async function* () {
    yield { type: "error", code: "unavailable" }
  } as never)
  const res = await POST(
    post({ businessId: "b1", messages: [{ role: "owner", text: "hi" }] })
  )
  expect(await events(res)).toEqual([{ type: "error", code: "unavailable" }])
})

test("happy path streams ndjson text then done with trimmed history", async () => {
  const messages = Array.from(
    { length: ASSISTANT_RULES.maxHistoryMessages + 5 },
    (_, i) => ({ role: "owner" as const, text: `m${i}` })
  )
  const res = await POST(post({ businessId: "b1", messages }))
  expect(res.headers.get("Content-Type")).toBe("application/x-ndjson")
  expect(res.headers.get("Cache-Control")).toBe("no-store")
  expect(await events(res)).toEqual([
    { type: "text", delta: "hi" },
    { type: "done" },
  ])
  const calls = vi.mocked(runChat).mock.calls
  const [gotMessages, gotContext] = calls[calls.length - 1] as [
    unknown[],
    { businessName: string },
    unknown,
    unknown?,
  ]
  expect(gotMessages.length).toBe(ASSISTANT_RULES.maxHistoryMessages)
  expect(gotContext.businessName).toBe("Salon")
})

test("language comes from the cookie, a lang body field is ignored", async () => {
  vi.mocked(getOwnerLanguage).mockResolvedValue("es")
  const res = await POST(
    post({
      businessId: "b1",
      messages: [{ role: "owner", text: "hi" }],
      lang: "en",
    })
  )
  expect(await events(res)).toEqual([
    { type: "text", delta: "hi" },
    { type: "done" },
  ])
  const calls = vi.mocked(runChat).mock.calls
  const gotContext = calls[calls.length - 1]?.[1] as { language: string }
  expect(gotContext.language).toBe("es")
})

test("voice true reaches runChat, absent stays false", async () => {
  const body = {
    businessId: "b1",
    messages: [{ role: "owner", text: "hi" }],
    voice: true,
  }
  const res = await POST(post(body))
  expect(res.status).toBe(200)
  const calls = vi.mocked(runChat).mock.calls
  const gotContext = calls[calls.length - 1]?.[1] as { voice: boolean }
  expect(gotContext.voice).toBe(true)

  await POST(
    post({ businessId: "b1", messages: [{ role: "owner", text: "hi" }] })
  )
  const later = vi.mocked(runChat).mock.calls
  expect((later[later.length - 1]?.[1] as { voice: boolean }).voice).toBe(
    false
  )
})

test("a non-boolean voice is a bad request", async () => {
  const res = await POST(
    post({
      businessId: "b1",
      messages: [{ role: "owner", text: "hi" }],
      voice: "yes",
    })
  )
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: "bad_request" })
})
