// @vitest-environment node
import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, chatConnections, koblipChatConnection, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const {
  attemptAccount,
  chatAccessToken,
  chatDoneUrl,
  endChatConnection,
  endKoblipChatConnection,
  finishChatConnect,
  koblipChatApi,
  koblipChatConnectionStatus,
  readChatAttempt,
  startChatConnect,
} = await import("./chat-oauth")
const { chatConnectionFor } = await import("./chat-templates")

let dir: string
let closeDb: () => void
let issued = 0

// A stand-in for Chat's token and revoke endpoints.
const chat = vi.fn(async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body))
  const answer = (status: number, json: unknown) =>
    new Response(JSON.stringify(json), { status })
  if (body.client_secret !== "secret") return answer(401, { code: "invalid_client" })
  if (url.endsWith("/api/oauth/revoke")) return answer(200, { success: true })
  issued += 1
  return answer(200, {
    success: true,
    data: {
      access_token: `koa_${issued}`,
      refresh_token: `kor_${issued}`,
      expires_in: 3600,
      scope: "contacts templates automations conversations",
      workspace_id: "w1",
      workspace_name: "Lumen Studio",
    },
  })
})

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-chat-oauth-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"))
  vi.stubEnv("CHAT_OAUTH_CLIENT_ID", "koblip-book")
  vi.stubEnv("CHAT_OAUTH_CLIENT_SECRET", "secret")
  vi.stubEnv("CHAT_OAUTH_REDIRECT_URI", "http://localhost:3100/api/chat/callback")
  vi.stubEnv("CHAT_CONNECT_URL", "https://chat.example.test/connect/koblip-book")
  vi.stubEnv("CHAT_API_URL", "https://api.example.test")
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100")
  vi.stubGlobal("fetch", chat)
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({ id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false })
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
})

afterEach(() => chat.mockClear())

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

test("the consent link carries a PKCE challenge of the sealed verifier", () => {
  const { url, cookie } = startChatConnect({ businessId: "biz" }, "u1")
  const link = new URL(url)
  expect(link.origin + link.pathname).toBe("https://chat.example.test/connect/koblip-book")
  expect(link.searchParams.get("code_challenge_method")).toBe("S256")
  expect(link.searchParams.get("scope")).toBe("contacts templates automations conversations")
  const state = link.searchParams.get("state")
  const attempt = readChatAttempt(cookie, state)
  expect(attempt).toMatchObject({ businessId: "biz", userId: "u1" })
  expect(createHash("sha256").update(attempt!.verifier).digest("base64url")).toBe(
    link.searchParams.get("code_challenge")
  )
  expect(cookie).not.toContain(attempt!.verifier)
})

test("an answer with another state, or a changed cookie, is refused", () => {
  const { url, cookie } = startChatConnect({ businessId: "biz" }, "u1")
  const state = new URL(url).searchParams.get("state")!
  expect(readChatAttempt(cookie, state + "x")).toBeNull()
  expect(readChatAttempt(cookie, null)).toBeNull()
  expect(readChatAttempt(undefined, state)).toBeNull()
  expect(readChatAttempt(cookie.slice(0, -2) + "AA", state)).toBeNull()
})

test("connecting saves sealed tokens; the screen sees only the workspace", async () => {
  expect(await finishChatConnect({ businessId: "biz" }, "koc_code", "v".repeat(43))).toBe(true)
  const sent = JSON.parse(String(chat.mock.calls[0][1].body))
  expect(sent).toMatchObject({ grant_type: "authorization_code", code: "koc_code", redirect_uri: "http://localhost:3100/api/chat/callback" })
  const [row] = await db.select().from(chatConnections)
  expect(row.accessToken).not.toContain("koa_")
  expect(row.refreshToken).not.toContain("kor_")
  expect(await chatConnectionFor("biz")).toEqual({ workspaceName: "Lumen Studio", needsReconnect: false, messages: "noNumber" })
  expect(await chatAccessToken("biz")).toBe(`koa_${issued}`)
  expect(chat).toHaveBeenCalledTimes(1)
})

test("an expiring token is refreshed once, even when asked for twice", async () => {
  await db.update(chatConnections).set({ accessExpiresAt: new Date().toISOString() })
  const before = issued
  const [a, b] = await Promise.all([chatAccessToken("biz"), chatAccessToken("biz")])
  expect(a).toBe(`koa_${before + 1}`)
  expect(b).toBe(a)
  expect(chat).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(chat.mock.calls[0][1].body))).toMatchObject({ grant_type: "refresh_token", refresh_token: `kor_${before}` })
})

test("a refused refresh drops the tokens and asks to reconnect", async () => {
  await db.update(chatConnections).set({ accessExpiresAt: new Date().toISOString() })
  chat.mockImplementationOnce(async () => new Response(JSON.stringify({ code: "invalid_grant" }), { status: 400 }))
  expect(await chatAccessToken("biz")).toBeNull()
  expect(await chatConnectionFor("biz")).toEqual({ workspaceName: "Lumen Studio", needsReconnect: true, messages: "noNumber" })
  const [row] = await db.select().from(chatConnections)
  expect(row.accessToken).toBeNull()
  expect(row.refreshToken).toBeNull()
})

test("disconnect revokes at Chat and forgets the connection", async () => {
  expect(await finishChatConnect({ businessId: "biz" }, "koc_again", "v".repeat(43))).toBe(true)
  chat.mockClear()
  await endChatConnection("biz")
  expect(chat.mock.calls[0][0]).toBe("https://api.example.test/api/oauth/revoke")
  expect(JSON.parse(String(chat.mock.calls[0][1].body)).token).toBe(`kor_${issued}`)
  expect(await chatConnectionFor("biz")).toBeNull()
})

test("a code Chat refuses saves nothing", async () => {
  chat.mockImplementationOnce(async () => new Response(JSON.stringify({ code: "invalid_grant" }), { status: 400 }))
  expect(await finishChatConnect({ businessId: "biz" }, "koc_bad", "v".repeat(43))).toBe(false)
  expect(await chatConnectionFor("biz")).toBeNull()
})

test("Koblip's own connection is kept apart from every business", async () => {
  const { url, cookie } = startChatConnect("koblip", "u1")
  const attempt = readChatAttempt(cookie, new URL(url).searchParams.get("state"))
  expect(attemptAccount(attempt!)).toBe("koblip")
  expect(chatDoneUrl("koblip", "connected").search).toBe("?for=koblip&result=connected")

  expect(await finishChatConnect("koblip", "koc_koblip", "v".repeat(43), "u1")).toBe(true)
  const [row] = await db.select().from(koblipChatConnection)
  expect(row).toMatchObject({ id: "koblip", workspaceName: "Lumen Studio", connectedBy: "u1" })
  expect(row.accessToken).not.toContain("koa_")
  expect(await db.select().from(chatConnections)).toEqual([])
  expect(await chatAccessToken("biz")).toBeNull()
  expect(await koblipChatConnectionStatus()).toEqual({ workspaceName: "Lumen Studio", needsReconnect: false })

  chat.mockClear()
  chat.mockImplementationOnce(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
  await koblipChatApi("/api/whatsapp/connections")
  expect(chat.mock.calls[0][0]).toBe("https://api.example.test/api/whatsapp/connections")
  expect((chat.mock.calls[0][1].headers as Record<string, string>).authorization).toBe(`Bearer koa_${issued}`)

  chat.mockClear()
  await endKoblipChatConnection()
  expect(chat.mock.calls[0][0]).toBe("https://api.example.test/api/oauth/revoke")
  expect(await koblipChatConnectionStatus()).toBeNull()
})
