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
vi.mock("@/features/assistant/api/check-answer", () => ({
  checkAnswer: vi.fn(async () => ({ ok: true })),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { checkAnswer } = await import("@/features/assistant/api/check-answer")
const { resetAnswerChecksForTests, storeAnswerCheck } =
  await import("@/features/assistant/api/answer-checks")
const { POST } = await import("./route")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const BUSINESS = { id: "b1", name: "Salon", timezone: "Europe/Madrid" }

function post(body: unknown, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin !== undefined) headers.origin = origin
  return new Request("http://localhost/api/assistant/check", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

async function events(res: Response) {
  return (await res.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line))
}

function store(ownerId = "u1", businessId = "b1") {
  const stored = storeAnswerCheck({
    ownerId,
    businessId,
    question: "Which service?",
    toolResults: ['{"data":{"services":["Cut","Fade"]}}'],
    answer: "Which one?",
    labels: { done: "Answer checked", failed: "Couldn't check the answer" },
  })
  if ("error" in stored) throw new Error("not stored")
  return stored.id
}

beforeEach(() => {
  resetAnswerChecksForTests()
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockResolvedValue({ business: BUSINESS } as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(checkAnswer).mockClear()
})

test("runs the check once and streams its outcome, never buttons", async () => {
  const id = store()
  expect(await events(await POST(post({ businessId: "b1", id })))).toEqual([
    { type: "step", id, label: "Answer checked", status: "done" },
    { type: "done" },
  ])
  // Single use.
  expect(await events(await POST(post({ businessId: "b1", id })))).toEqual([
    { type: "error", code: "expired" },
  ])
  expect(checkAnswer).toHaveBeenCalledTimes(1)
})

test("a failed check marks the answer unchecked", async () => {
  vi.mocked(checkAnswer).mockResolvedValueOnce({ ok: "unknown" })
  const id = store()
  expect(await events(await POST(post({ businessId: "b1", id })))).toEqual([
    {
      type: "step",
      id,
      label: "Couldn't check the answer",
      status: "failed",
    },
    { type: "notice", kind: "unverified" },
    { type: "done" },
  ])
})

test("another owner's or business's check is refused and stays", async () => {
  const id = store("u2")
  expect(await events(await POST(post({ businessId: "b1", id })))).toEqual([
    { type: "error", code: "expired" },
  ])
  const other = store("u1", "b2")
  expect(
    await events(await POST(post({ businessId: "b1", id: other })))
  ).toEqual([{ type: "error", code: "expired" }])
  expect(checkAnswer).not.toHaveBeenCalled()
})

test("guards: cross-site, signed out, rate limit, bad body, not owned", async () => {
  const id = store()
  expect(
    (await POST(post({ businessId: "b1", id }, "https://evil.example"))).status
  ).toBe(403)
  vi.mocked(getSession).mockResolvedValueOnce(null)
  expect((await POST(post({ businessId: "b1", id }))).status).toBe(401)
  vi.mocked(checkAssistantRateLimit).mockReturnValueOnce(false)
  expect(await events(await POST(post({ businessId: "b1", id })))).toEqual([
    { type: "error", code: "rate_limited" },
  ])
  expect(checkAssistantRateLimit).toHaveBeenLastCalledWith(
    "check:u1",
    expect.any(Number)
  )
  expect((await POST(post({ businessId: "b1" }))).status).toBe(400)
  vi.mocked(ownedBusiness).mockResolvedValueOnce(null)
  expect(await events(await POST(post({ businessId: "b1", id })))).toEqual([
    { type: "error", code: "not_allowed" },
  ])
  expect(checkAnswer).not.toHaveBeenCalled()
})
