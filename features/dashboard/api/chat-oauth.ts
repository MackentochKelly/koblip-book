import "server-only"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { chatConnections, chatTemplates, koblipChatConnection } from "@/lib/db/schema"
import { notification } from "@/lib/in-app-notifications"
import { open, seal } from "@/lib/secret-box"
import type { ChatConnectResult } from "@/types/chat-connect"

// "Connect with Koblip Chat": OAuth 2.0 authorization code with PKCE, Book as
// a server app (docs/koblip-chat-integration.md, step 1; Chat's side in
// wapi-api docs/api/oauth.md). Tokens and the client secret never leave the
// server.

// Everything Book may ask for; Chat's consent page lists them.
const SCOPES = "contacts templates automations conversations"
// A connection made before Book asked for this must be made again.
const NEEDED_SCOPE = "templates"
// How long the owner has to answer in the Chat window.
const ATTEMPT_MINUTES = 10
// Refresh this long before the access token runs out.
const REFRESH_EARLY_MS = 60_000

// The cookie that ties Chat's answer to the browser and business that asked.
export const CHAT_ATTEMPT_COOKIE = "koblip_chat_connect"
export const CHAT_ATTEMPT_COOKIE_PATH = "/api/chat"
export const CHAT_ATTEMPT_MAX_AGE = ATTEMPT_MINUTES * 60

function config() {
  const values = {
    clientId: process.env.CHAT_OAUTH_CLIENT_ID,
    clientSecret: process.env.CHAT_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.CHAT_OAUTH_REDIRECT_URI,
    connectUrl: process.env.CHAT_CONNECT_URL,
    apiUrl: process.env.CHAT_API_URL,
  }
  for (const [name, value] of Object.entries(values)) {
    if (!value) throw new Error(`Koblip Chat connection: ${name} is not set. See .env.example.`)
  }
  return values as { [K in keyof typeof values]: string }
}

// Whose connection: a business's own workspace, or Koblip's, which an admin
// connects once and which sends for every business without its own (K1).
export type ChatAccount = { businessId: string } | "koblip"

// Where the Chat window ends (app/(owner)/connect/chat), at this site's
// public address. Not the request's own URL: behind the server's proxy that is
// the internal one (localhost).
export function chatDoneUrl(account: ChatAccount, result: ChatConnectResult) {
  const site = process.env.BETTER_AUTH_URL
  if (!site) throw new Error("Koblip Chat connection: BETTER_AUTH_URL is not set. See .env.example.")
  const url = new URL("/connect/chat", site)
  url.search = new URLSearchParams(
    account === "koblip" ? { for: "koblip", result } : { businessId: account.businessId, result }
  ).toString()
  return url
}

type Attempt = {
  state: string
  verifier: string
  // Empty for Koblip's own connection.
  businessId: string
  koblip?: boolean
  userId: string
  startedAt: number
}

// The account an attempt connects.
export function attemptAccount(attempt: Attempt): ChatAccount {
  return attempt.koblip ? "koblip" : { businessId: attempt.businessId }
}

// The Chat consent URL to open, and the sealed attempt to keep in a cookie.
export function startChatConnect(account: ChatAccount, userId: string) {
  const { clientId, redirectUri, connectUrl } = config()
  const attempt: Attempt = {
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    businessId: account === "koblip" ? "" : account.businessId,
    ...(account === "koblip" ? { koblip: true } : {}),
    userId,
    startedAt: Date.now(),
  }
  const url = new URL(connectUrl)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state: attempt.state,
    code_challenge: createHash("sha256").update(attempt.verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope: SCOPES,
  }).toString()
  return { url: url.toString(), cookie: seal(JSON.stringify(attempt)) }
}

// The attempt Chat answered, only when its state matches and it is recent.
export function readChatAttempt(
  cookie: string | undefined,
  state: string | null
): Attempt | null {
  if (!cookie || !state) return null
  let attempt: Attempt
  try {
    attempt = JSON.parse(open(cookie))
  } catch {
    return null
  }
  const expected = Buffer.from(attempt.state)
  const given = Buffer.from(state)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (Date.now() - attempt.startedAt > ATTEMPT_MINUTES * 60_000) return null
  return attempt
}

type Tokens = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  workspace_id: string
  workspace_name: string
}

type TokenAnswer =
  | { ok: true; tokens: Tokens }
  // Chat answered no (its error code), or the answer never came (null).
  | { ok: false; code: string | null }

async function tokenCall(body: Record<string, string>): Promise<TokenAnswer> {
  const { clientId, clientSecret, apiUrl } = config()
  try {
    const res = await fetch(`${apiUrl}/api/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, client_id: clientId, client_secret: clientSecret }),
      cache: "no-store",
    })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.data?.access_token) return { ok: true, tokens: json.data }
    return { ok: false, code: typeof json?.code === "string" ? json.code : null }
  } catch {
    return { ok: false, code: null }
  }
}

type Saved = {
  workspaceId: string
  accessToken: string | null
  refreshToken: string | null
  accessExpiresAt: string | null
  needsReconnect: boolean
}

// Where an account's connection is kept: a business's row, or Koblip's one row.
type Store = {
  key: string
  read(): Promise<Saved | undefined>
  save(tokens: Tokens, connectedBy?: string): Promise<void>
  dropTokens(): Promise<void>
  remove(): Promise<void>
}

function tokenColumns(tokens: Tokens) {
  return {
    workspaceId: tokens.workspace_id,
    workspaceName: tokens.workspace_name,
    scopes: tokens.scope,
    accessToken: seal(tokens.access_token),
    refreshToken: seal(tokens.refresh_token),
    accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    needsReconnect: false,
  }
}

const NO_TOKENS = { accessToken: null, refreshToken: null, accessExpiresAt: null, needsReconnect: true }

// Templates and the number belong to one workspace: connecting another one
// starts them over.
async function forgetWorkspace(businessId: string) {
  await db.delete(chatTemplates).where(eq(chatTemplates.businessId, businessId))
}

function businessStore(businessId: string): Store {
  const where = eq(chatConnections.businessId, businessId)
  return {
    key: `business:${businessId}`,
    read: async () => (await db.select().from(chatConnections).where(where).limit(1))[0],
    async save(tokens) {
      const before = await this.read()
      const moved = !!before && before.workspaceId !== tokens.workspace_id
      if (moved) await forgetWorkspace(businessId)
      const row = { ...tokenColumns(tokens), ...(moved ? { wabaId: null, phoneNumberId: null } : {}) }
      await db
        .insert(chatConnections)
        .values({ businessId, ...row })
        .onConflictDoUpdate({ target: chatConnections.businessId, set: row })
    },
    async dropTokens() {
      // The owner's bell hears the connection must be renewed, once each
      // time it stops working, saved with it.
      const [row] = await db
        .select({ needsReconnect: chatConnections.needsReconnect })
        .from(chatConnections)
        .where(where)
        .limit(1)
      const notice = row && !row.needsReconnect ? await notification(businessId, "connectionRenew", {}) : []
      await saveAll([db.update(chatConnections).set(NO_TOKENS).where(where), ...notice])
    },
    async remove() {
      await forgetWorkspace(businessId)
      await db.delete(chatConnections).where(where)
    },
  }
}

const koblipWhere = eq(koblipChatConnection.id, "koblip")
const koblipStore: Store = {
  key: "koblip",
  read: async () => (await db.select().from(koblipChatConnection).where(koblipWhere).limit(1))[0],
  async save(tokens, connectedBy) {
    const before = await this.read()
    const moved = !!before && before.workspaceId !== tokens.workspace_id
    const row = {
      ...tokenColumns(tokens),
      ...(moved ? { wabaId: null, phoneNumberId: null } : {}),
      ...(connectedBy ? { connectedBy } : {}),
    }
    await db
      .insert(koblipChatConnection)
      .values({ id: "koblip", ...row })
      .onConflictDoUpdate({ target: koblipChatConnection.id, set: row })
  },
  async dropTokens() {
    await db.update(koblipChatConnection).set(NO_TOKENS).where(koblipWhere)
  },
  async remove() {
    await db.delete(koblipChatConnection).where(koblipWhere)
  },
}

function storeFor(account: ChatAccount) {
  return account === "koblip" ? koblipStore : businessStore(account.businessId)
}

// Swaps Chat's one-time code for tokens and saves them. False if Chat said no.
// userId is who connected it, kept for Koblip's own connection.
export async function finishChatConnect(
  account: ChatAccount,
  code: string,
  verifier: string,
  userId?: string
): Promise<boolean> {
  const { redirectUri } = config()
  const answer = await tokenCall({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  })
  if (!answer.ok) return false
  await storeFor(account).save(answer.tokens, userId)
  return true
}

async function freshAccessToken(store: Store): Promise<string | null> {
  const row = await store.read()
  if (!row?.accessToken || !row.refreshToken || row.needsReconnect) return null
  if (row.accessExpiresAt && Date.parse(row.accessExpiresAt) - REFRESH_EARLY_MS > Date.now()) {
    return open(row.accessToken)
  }
  const answer = await tokenCall({
    grant_type: "refresh_token",
    refresh_token: open(row.refreshToken),
  })
  if (answer.ok) {
    await store.save(answer.tokens)
    return answer.tokens.access_token
  }
  // Too many tries: nothing changed at Chat, so the same token works later.
  if (answer.code === "rate_limited") return null
  // Any other failure, a lost answer included, may have used the refresh
  // token up; Chat cuts the connection if it is ever sent again.
  await store.dropTokens()
  return null
}

// One refresh at a time per connection: Chat treats a second use of a
// refresh token as theft and ends the connection. (One server process;
// several would need a shared lock.)
const refreshing = new Map<string, Promise<string | null>>()

function accessTokenFor(account: ChatAccount): Promise<string | null> {
  const store = storeFor(account)
  let pending = refreshing.get(store.key)
  if (!pending) {
    pending = freshAccessToken(store).finally(() => refreshing.delete(store.key))
    refreshing.set(store.key, pending)
  }
  return pending
}

// A working access token for Chat's API, refreshed when it is about to run
// out, or null when the business is not connected or must reconnect.
export function chatAccessToken(businessId: string): Promise<string | null> {
  return accessTokenFor({ businessId })
}

// Whether the connection still works and allows everything Book asks for.
export function chatConnectionUsable(row: { needsReconnect: boolean; scopes: string }) {
  return !row.needsReconnect && row.scopes.split(" ").includes(NEEDED_SCOPE)
}

export class ChatApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
    // Chat's own words, such as Meta's reason for refusing a template.
    readonly reason: string | null = null
  ) {
    super(`Koblip Chat API: ${status ?? "no answer"} ${code ?? ""} ${reason ?? ""}`.trim())
  }
}

// Chat answers a refusal with `message` or `error`; kept short for the log.
function reasonOf(json: { message?: unknown; error?: unknown } | null) {
  const text = [json?.message, json?.error].find((value) => typeof value === "string")
  return typeof text === "string" ? text.slice(0, 200) : null
}

type ApiInit = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }

// One call to Chat's API as this business, in its connected workspace (the
// token holds it). Throws ChatApiError when not connected or Chat says no.
export function chatApi<T>(businessId: string, path: string, init: ApiInit = {}): Promise<T> {
  return callChat<T>({ businessId }, path, init)
}

// The same, in Koblip's own workspace (K1).
export function koblipChatApi<T>(path: string, init: ApiInit = {}): Promise<T> {
  return callChat<T>("koblip", path, init)
}

async function callChat<T>(account: ChatAccount, path: string, init: ApiInit): Promise<T> {
  const token = await accessTokenFor(account)
  if (!token) throw new ChatApiError(null, "not_connected")
  const { apiUrl } = config()
  let res: Response
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    })
  } catch {
    throw new ChatApiError(null, null)
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ChatApiError(res.status, typeof json?.code === "string" ? json.code : null, reasonOf(json))
  }
  return json as T
}

// Ends the connection at Chat, then forgets it here. Forgetting happens even
// if Chat cannot be reached; the owner can also revoke it in Chat.
export function endChatConnection(businessId: string) {
  return endConnection({ businessId })
}

// The same for Koblip's own connection.
export function endKoblipChatConnection() {
  return endConnection("koblip")
}

async function endConnection(account: ChatAccount) {
  const store = storeFor(account)
  const row = await store.read()
  if (row?.refreshToken) {
    const { clientId, clientSecret, apiUrl } = config()
    await fetch(`${apiUrl}/api/oauth/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        token: open(row.refreshToken),
      }),
      cache: "no-store",
    }).catch(() => null)
  }
  await store.remove()
}

// Koblip's own connection as the admin sees it, never a token.
export async function koblipChatConnectionStatus() {
  const [row] = await db
    .select({
      workspaceName: koblipChatConnection.workspaceName,
      needsReconnect: koblipChatConnection.needsReconnect,
      scopes: koblipChatConnection.scopes,
    })
    .from(koblipChatConnection)
    .where(koblipWhere)
    .limit(1)
  if (!row) return null
  return { workspaceName: row.workspaceName, needsReconnect: !chatConnectionUsable(row) }
}

// Every business's own connection as the admin's Businesses list sees it
// (A4), never a token.
export async function businessChatConnections() {
  const rows = await db
    .select({
      businessId: chatConnections.businessId,
      workspaceName: chatConnections.workspaceName,
      needsReconnect: chatConnections.needsReconnect,
      scopes: chatConnections.scopes,
      phoneNumberId: chatConnections.phoneNumberId,
    })
    .from(chatConnections)
  return rows.map((row) => ({
    businessId: row.businessId,
    workspaceName: row.workspaceName,
    phoneNumberId: row.phoneNumberId,
    needsReconnect: !chatConnectionUsable(row),
  }))
}
