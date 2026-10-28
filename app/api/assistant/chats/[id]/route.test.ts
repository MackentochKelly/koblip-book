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

const { getSession } = await import("@/lib/dal")
const { ownedBusiness } = await import("@/features/dashboard/api/owned-business")
const { checkAssistantRateLimit } =
  await import("@/features/assistant/api/rate-limit")
const { GET, PUT, DELETE } = await import("./route")

const OWNER = { userId: "u1", name: "Owner", email: "o@x.com" }
const OTHER = { userId: "other", name: "Other", email: "other@x.com" }
const ID = "11111111-1111-4111-8111-111111111111"

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-chat-test-"))
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

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function get(path: string, origin?: string) {
  const headers: Record<string, string> = {}
  if (origin !== undefined) {
    headers.origin = origin
  }
  return new Request(`http://localhost${path}`, { headers })
}

function put(id: string, body: unknown, origin?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (origin !== undefined) {
    headers.origin = origin
  }
  return new Request(`http://localhost/api/assistant/chats/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
}

const MESSAGES = [
  { role: "owner", text: "How many bookings today?" },
  { role: "assistant", text: "You have 2." },
]

async function seed(ownerId = "u1") {
  const { saveAssistantChat } = await import("@/features/assistant/api/chats")
  await saveAssistantChat({
    id: ID,
    businessId: "b1",
    ownerId,
    messages: MESSAGES as never,
  })
}

test("guards run in order on every method", async () => {
  const badOrigin = "https://evil.com"
  expect(await GET(get(`/api/assistant/chats/${ID}?businessId=b1`, badOrigin), params(ID))).toMatchObject({ status: 403 })
  expect(
    await PUT(put(ID, {}, badOrigin), params(ID))
  ).toMatchObject({ status: 403 })
  vi.mocked(getSession).mockResolvedValue(null)
  expect(await GET(get(`/api/assistant/chats/${ID}?businessId=b1`), params(ID))).toMatchObject({ status: 401 })
  expect(
    await DELETE(get(`/api/assistant/chats/${ID}?businessId=b1`), params(ID))
  ).toMatchObject({ status: 401 })
  vi.mocked(getSession).mockResolvedValue(OWNER as never)
  vi.mocked(checkAssistantRateLimit).mockReturnValue(false)
  expect(await GET(get(`/api/assistant/chats/${ID}?businessId=b1`), params(ID))).toMatchObject({ status: 429 })
  vi.mocked(checkAssistantRateLimit).mockReturnValue(true)
  expect(
    await GET(get(`/api/assistant/chats/${ID}?businessId=nope`), params(ID))
  ).toMatchObject({ status: 404 })
})

test("GET returns the chat, or 404", async () => {
  await seed()
  const res = await GET(
    get(`/api/assistant/chats/${ID}?businessId=b1`),
    params(ID)
  )
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    id: ID,
    title: "How many bookings today?",
    messages: [
      { role: "owner", text: "How many bookings today?" },
      { role: "assistant", text: "You have 2." },
    ],
  })
  expect(
    await GET(
      get(
        "/api/assistant/chats/22222222-2222-4222-8222-222222222222?businessId=b1"
      ),
      params("22222222-2222-4222-8222-222222222222")
    )
  ).toMatchObject({ status: 404 })
  expect(await GET(get("/api/assistant/chats/nope?businessId=b1"), params("nope"))).toMatchObject({ status: 400 })
})

test("another owner's chat answers 404 on GET, PUT and DELETE", async () => {
  await seed("other")
  expect(
    await GET(get(`/api/assistant/chats/${ID}?businessId=b1`), params(ID))
  ).toMatchObject({ status: 404 })
  expect(
    await PUT(put(ID, { businessId: "b1", messages: MESSAGES }), params(ID))
  ).toMatchObject({ status: 404 })
  expect(
    await DELETE(
      get(`/api/assistant/chats/${ID}?businessId=b1`),
      params(ID)
    )
  ).toMatchObject({ status: 404 })
  // Untouched: the other owner still sees their words.
  vi.mocked(getSession).mockResolvedValue(OTHER as never)
  const res = await GET(
    get(`/api/assistant/chats/${ID}?businessId=b1`),
    params(ID)
  )
  expect(res.status).toBe(200)
})

test("PUT creates, then replaces messages but keeps the first title", async () => {
  expect(
    await PUT(put(ID, { businessId: "b1", messages: MESSAGES }), params(ID))
  ).toMatchObject({ status: 204 })
  const created = await GET(
    get(`/api/assistant/chats/${ID}?businessId=b1`),
    params(ID)
  )
  expect(await created.json()).toMatchObject({
    title: "How many bookings today?",
  })
  const next = [
    { role: "owner", text: "And tomorrow?" },
    { role: "assistant", text: "Three." },
  ]
  expect(
    await PUT(put(ID, { businessId: "b1", messages: next }), params(ID))
  ).toMatchObject({ status: 204 })
  const replaced = await GET(
    get(`/api/assistant/chats/${ID}?businessId=b1`),
    params(ID)
  )
  expect(await replaced.json()).toEqual({
    id: ID,
    title: "How many bookings today?",
    messages: next,
  })
})

test("PUT trims the title to maxChatTitleChars", async () => {
  await PUT(
    put(ID, {
      businessId: "b1",
      messages: [{ role: "owner", text: `  ${"x".repeat(70)}  ` }],
    }),
    params(ID)
  )
  const res = await GET(
    get(`/api/assistant/chats/${ID}?businessId=b1`),
    params(ID)
  )
  const chat = (await res.json()) as { title: string }
  expect(chat.title).toBe("x".repeat(60))
})

test("bad bodies answer 400", async () => {
  const bad: [string, unknown][] = [
    ["not an array", { businessId: "b1", messages: "hello" }],
    ["empty", { businessId: "b1", messages: [] }],
    ["only empties", { businessId: "b1", messages: [{ role: "owner", text: "  " }] }],
    ["bad role", { businessId: "b1", messages: [{ role: "user", text: "hi" }] }],
    ["bad text", { businessId: "b1", messages: [{ role: "owner", text: 42 }] }],
    [
      "too long",
      { businessId: "b1", messages: [{ role: "owner", text: "x".repeat(8001) }] },
    ],
    [
      "too many",
      {
        businessId: "b1",
        messages: Array.from({ length: 201 }, (_, i) => ({
          role: "owner",
          text: `m${i}`,
        })),
      },
    ],
    ["no business", { messages: MESSAGES }],
    ["no messages", { businessId: "b1" }],
  ]
  for (const [label, body] of bad) {
    expect(await PUT(put(ID, body), params(ID)), label).toMatchObject({
      status: 400,
    })
  }
  expect(await PUT(put("nope", { businessId: "b1", messages: MESSAGES }), params("nope"))).toMatchObject({ status: 400 })
})

test("DELETE removes the chat, then it is gone", async () => {
  await seed()
  expect(
    await DELETE(
      get(`/api/assistant/chats/${ID}?businessId=b1`),
      params(ID)
    )
  ).toMatchObject({ status: 204 })
  expect(
    await GET(get(`/api/assistant/chats/${ID}?businessId=b1`), params(ID))
  ).toMatchObject({ status: 404 })
  expect(
    await DELETE(
      get(`/api/assistant/chats/${ID}?businessId=b1`),
      params(ID)
    )
  ).toMatchObject({ status: 404 })
})
