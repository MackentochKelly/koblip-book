// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/features/dashboard/api/owned-business", () => ({
  ownedBusiness: vi.fn(),
}))
vi.mock("@/features/assistant/api/rate-limit", () => ({
  checkAssistantRateLimit: vi.fn(() => true),
}))

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } = await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { GET } = await import("./route")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-chats-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  const { businesses, user } = await import("@/lib/db/schema")
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "o@x.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@x.com", emailVerified: false },
  ])
  await db.insert(businesses).values({
    id: "b1",
    slug: "salon",
    name: "Salon",
    timezone: "Europe/Madrid",
    currency: "EUR",
    ownerId: "u1",
  })
})

afterAll(async () => {
  const { db } = await import("@/lib/db")
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(ownedBusiness).mockImplementation(async (businessId: string) =>
    businessId === "b1" ? ({ business: { id: "b1" } }) as never : null
  )
  const { db } = await import("@/lib/db")
  const { assistantConversations } = await import("@/lib/db/schema")
  await db.delete(assistantConversations)
})

function get(path: string, origin?: string) {
  const headers: Record<string, string> = {}
  if (origin !== undefined) {
    headers.origin = origin
  }
  return new Request(`http://localhost${path}`, { headers })
}

function uuid(n: number) {
  return `11111111-1111-4111-8111-1111111111${String(n).padStart(2, "0")}`
}

let nextId = 0

async function seed(
  count: number,
  ownerId = "u1",
  businessId = "b1"
): Promise<string[]> {
  const { saveAssistantChat } = await import("@/features/assistant/api/chats")
  const ids: string[] = []
  for (let i = 0; i < count; i += 1) {
    const id = uuid(nextId)
    nextId += 1
    ids.push(id)
    await saveAssistantChat({
      id,
      businessId,
      ownerId,
      messages: [{ role: "owner", text: `hello ${i}` }],
    })
  }
  return ids
}

async function stamp(ids: string[], baseMs: number) {
  const { db } = await import("@/lib/db")
  const { assistantConversations } = await import("@/lib/db/schema")
  for (let i = 0; i < ids.length; i += 1) {
    await db
      .update(assistantConversations)
      .set({ updatedAt: new Date(baseMs + i * 1000).toISOString() })
      .where(eq(assistantConversations.id, ids[i]))
  }
}

test("guards run in order: cross-site, session, rate limit, business", async () => {
  expect(
    await GET(get("/api/assistant/chats?businessId=b1", "https://evil.com"))
  ).toMatchObject({ status: 403 })
  vi.mocked(getSession).mockResolvedValue(null)
  expect(await GET(get("/api/assistant/chats?businessId=b1"))).toMatchObject(
    { status: 401 }
  )
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(false)
  expect(await GET(get("/api/assistant/chats?businessId=b1"))).toMatchObject(
    { status: 429 }
  )
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  expect(
    await GET(get("/api/assistant/chats?businessId=nope"))
  ).toMatchObject({ status: 404 })
  expect(await GET(get("/api/assistant/chats"))).toMatchObject({
    status: 400,
  })
})

test("an empty list is an empty array", async () => {
  const res = await GET(get("/api/assistant/chats?businessId=b1"))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([])
})

test("newest updated first, at most recentChats", async () => {
  const ids = await seed(31)
  await stamp(ids, Date.UTC(2026, 9, 28))
  const res = await GET(get("/api/assistant/chats?businessId=b1"))
  const list = (await res.json()) as { id: string; title: string }[]
  expect(list.length).toBe(30)
  // ids[0] is the oldest and falls off the list.
  expect(list.map((c) => c.id)).toEqual(ids.slice(1).reverse())
  expect(list[0]).toMatchObject({ id: ids[30], title: "hello 30" })
})

test("another owner's chats never leak into the list", async () => {
  await seed(1, "other")
  const mine = await seed(1)
  const res = await GET(get("/api/assistant/chats?businessId=b1"))
  const list = (await res.json()) as { id: string }[]
  expect(list.map((c) => c.id)).toEqual(mine)
})
