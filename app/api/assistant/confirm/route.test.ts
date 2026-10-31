// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/features/dashboard/api/owned-business", () => ({
  ownedBusiness: vi.fn(),
}))
vi.mock("@/features/assistant/api/rate-limit", () => ({
  checkAssistantRateLimit: vi.fn(() => true),
}))
vi.mock("../tools", () => ({ buildAssistantTools: vi.fn() }))
vi.mock("@/features/assistant/api/audit-log", () => ({
  logAssistantAction: vi.fn(),
}))
vi.mock("@/features/dashboard/i18n/server", () => ({
  getOwnerLanguage: vi.fn(async () => "en"),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } =
  await import("@/features/dashboard/api/owned-business")
const { buildAssistantTools } = await import("../tools")
const { peekPendingAction, storePendingAction } =
  await import("@/features/assistant/api/pending-actions")

// Waiting cards live in the database: a fresh one per file.
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-confirm-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  const { businesses, user } = await import("@/lib/db/schema")
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "o@x.com", emailVerified: false },
    { id: "u2", name: "Other", email: "p@x.com", emailVerified: false },
  ])
  await db.insert(businesses).values(
    ["b1", "b9"].map((id) => ({
      id,
      slug: id,
      name: id,
      timezone: "Europe/Madrid",
      currency: "EUR",
      ownerId: "u1",
    }))
  )
})

afterAll(async () => {
  const { db } = await import("@/lib/db")
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
const { logAssistantAction } =
  await import("@/features/assistant/api/audit-log")
const { getOwnerLanguage } = await import("@/features/dashboard/i18n/server")
const { POST } = await import("./route")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const BUSINESS = { id: "b1", name: "Salon", timezone: "Europe/Madrid" }

const execute = vi.fn(
  async (args: unknown): Promise<{ ok: boolean; doneText: string }> => ({
    ok: true,
    doneText: `did ${JSON.stringify(args)}`,
  })
)

function tool(name = "cancel_booking", resultKind = "bookings") {
  return {
    definition: {
      name,
      description: "Cancel.",
      parameters: {},
      needsConfirm: true,
      resultKind,
    },
    label: "Cancelling…",
    run: async () => ({ error: "needs tap" }),
    confirm: {
      describe: async () => ({ title: "T", summary: "S", destructive: true }),
      execute,
    },
  }
}

function post(body: unknown, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin !== undefined) {
    headers.origin = origin
  }
  return new Request("http://localhost/api/assistant/confirm", {
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

async function store(
  ownerId = "u1",
  businessId = "b1",
  now = Date.now(),
  toolName = "cancel_booking"
) {
  const stored = await storePendingAction(
    {
      ownerId,
      businessId,
      toolName,
      args: { bookingId: "k1" },
    },
    now
  )
  if (!("id" in stored)) {
    throw new Error("store failed")
  }
  return stored.id
}

beforeEach(async () => {
  const { db } = await import("@/lib/db")
  const { assistantPendingActions } = await import("@/lib/db/schema")
  await db.delete(assistantPendingActions)
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockResolvedValue({
    business: BUSINESS,
    userId: "u1",
  } as never)
  vi.mocked(buildAssistantTools).mockReturnValue([tool()] as never)
  vi.mocked(getOwnerLanguage).mockResolvedValue("en")
  vi.mocked(logAssistantAction).mockClear()
  execute.mockClear()
  execute.mockImplementation(async (args: unknown) => ({
    ok: true,
    doneText: `did ${JSON.stringify(args)}`,
  }))
})

test("answers 401 when not logged in", async () => {
  vi.mocked(getSession).mockResolvedValue(null)
  const res = await POST(post({ businessId: "b1", id: "x", accept: true }))
  expect(res.status).toBe(401)
})

test("refuses a cross-site origin", async () => {
  const res = await POST(
    post({ businessId: "b1", id: "x", accept: true }, "https://evil.com")
  )
  expect(res.status).toBe(403)
})

test("unknown id gives expired", async () => {
  const res = await POST(post({ businessId: "b1", id: "nope", accept: true }))
  expect(await events(res)).toEqual([{ type: "error", code: "expired" }])
})

test("expired card is consumed and gives expired", async () => {
  const id = await store("u1", "b1", Date.now() - 11 * 60_000)
  const res = await POST(post({ businessId: "b1", id, accept: true }))
  expect(await events(res)).toEqual([{ type: "error", code: "expired" }])
  expect(await peekPendingAction(id)).toBeNull()
  const again = await POST(post({ businessId: "b1", id, accept: true }))
  expect(await events(again)).toEqual([{ type: "error", code: "expired" }])
})

test("another owner's card gives not_allowed and stays stored", async () => {
  const id = await store("u2", "b1")
  const res = await POST(post({ businessId: "b1", id, accept: true }))
  expect(await events(res)).toEqual([{ type: "error", code: "not_allowed" }])
  expect(execute).not.toHaveBeenCalled()
  // Still there for its owner.
  vi.mocked(getSession).mockResolvedValue({ ...OWNER, userId: "u2" } as never)
  const res2 = await POST(post({ businessId: "b1", id, accept: false }))
  expect((await events(res2))[0]).toMatchObject({ type: "text" })
})

test("another business's card gives not_allowed", async () => {
  const id = await store("u1", "b9")
  const res = await POST(post({ businessId: "b1", id, accept: true }))
  expect(await events(res)).toEqual([{ type: "error", code: "not_allowed" }])
  expect(execute).not.toHaveBeenCalled()
})

test("accept false runs nothing and ends", async () => {
  const id = await store()
  const res = await POST(post({ businessId: "b1", id, accept: false }))
  expect(await events(res)).toEqual([
    { type: "text", delta: "Okay, nothing was changed." },
    { type: "done" },
  ])
  expect(execute).not.toHaveBeenCalled()
})

test("accept true runs stored args only, extra body fields ignored", async () => {
  const id = await store()
  const res = await POST(
    post({ businessId: "b1", id, accept: true, args: { bookingId: "evil" } })
  )
  const list = await events(res)
  expect(list[0]).toMatchObject({ type: "step", status: "running" })
  expect(list[1]).toMatchObject({ type: "step", status: "done" })
  expect(list[2]).toEqual({
    type: "result",
    ok: true,
    text: 'did {"bookingId":"k1"}',
    kind: "bookings",
  })
  expect(list[3]).toEqual({ type: "done" })
  expect(execute).toHaveBeenCalledWith({ bookingId: "k1" })
  expect(logAssistantAction).toHaveBeenCalledWith({
    businessId: "b1",
    ownerId: "u1",
    tool: "cancel_booking",
    summary: 'did {"bookingId":"k1"}',
    status: "ok",
  })
})

test("declining logs no audit row", async () => {
  const id = await store()
  await POST(post({ businessId: "b1", id, accept: false }))
  expect(logAssistantAction).not.toHaveBeenCalled()
})

test("an id works once", async () => {
  const id = await store()
  await POST(post({ businessId: "b1", id, accept: true }))
  const again = await POST(post({ businessId: "b1", id, accept: true }))
  expect(await events(again)).toEqual([{ type: "error", code: "expired" }])
  expect(execute).toHaveBeenCalledTimes(1)
})

test("execute failure streams a failed step and server text", async () => {
  execute.mockResolvedValue({ ok: false, doneText: "Could not cancel (gone)." })
  const id = await store()
  const res = await POST(post({ businessId: "b1", id, accept: true }))
  const list = await events(res)
  expect(list[1]).toMatchObject({ type: "step", status: "failed" })
  expect(list[2]).toEqual({
    type: "result",
    ok: false,
    text: "Could not cancel (gone).",
    kind: "bookings",
  })
  expect(list[3]).toEqual({ type: "done" })
})

test("an execute that throws still ends with a result, in both languages", async () => {
  for (const [language, text] of [
    ["en", "I couldn't confirm it went through. Check the page to be sure."],
    ["es", "No pude confirmar si se hizo. Revisa la página para estar seguro."],
  ] as const) {
    vi.mocked(getOwnerLanguage).mockResolvedValue(language)
    vi.mocked(logAssistantAction).mockClear()
    execute.mockRejectedValueOnce(new Error("database is locked"))
    const id = await store()
    const list = await events(
      await POST(post({ businessId: "b1", id, accept: true }))
    )
    expect(list.slice(1)).toEqual([
      expect.objectContaining({ type: "step", status: "failed" }),
      { type: "result", ok: false, text, kind: "bookings" },
      { type: "done" },
    ])
    expect(logAssistantAction).toHaveBeenCalledWith(
      expect.objectContaining({ summary: text, status: "failed" })
    )
  }
})

test("accept false answers in the owner's language", async () => {
  vi.mocked(getOwnerLanguage).mockResolvedValue("es")
  const id = await store()
  const res = await POST(post({ businessId: "b1", id, accept: false }))
  expect(await events(res)).toEqual([
    { type: "text", delta: "Vale, no se cambió nada." },
    { type: "done" },
  ])
  expect(execute).not.toHaveBeenCalled()
})

test("confirm passes the cookie language to the tools", async () => {
  vi.mocked(getOwnerLanguage).mockResolvedValue("es")
  const id = await store()
  await POST(post({ businessId: "b1", id, accept: true }))
  expect(vi.mocked(buildAssistantTools)).toHaveBeenCalledWith("b1", "u1", "es")
})

test("each tool sends its result kind", async () => {
  const kinds: [string, string][] = [
    ["update_service", "services"],
    ["cancel_booking", "bookings"],
    ["delete_service", "services"],
    ["delete_team_member", "team"],
    ["set_hours", "hours"],
    ["create_booking", "bookings"],
  ]
  for (const [name, kind] of kinds) {
    vi.mocked(buildAssistantTools).mockReturnValue([tool(name, kind)] as never)
    const id = await store("u1", "b1", Date.now(), name)
    const res = await POST(post({ businessId: "b1", id, accept: true }))
    const list = await events(res)
    expect(list[2]).toEqual({
      type: "result",
      ok: true,
      text: 'did {"bookingId":"k1"}',
      kind,
    })
  }
})
