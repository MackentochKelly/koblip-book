import "server-only"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatConnections } from "@/lib/db/schema"
import { open, seal } from "@/lib/secret-box"
import type { ChatConnection, ChatConnectResult } from "../types/chat-connection"

// "Connect with Koblip Chat": OAuth 2.0 authorization code with PKCE, Book as
// a server app (docs/koblip-chat-integration.md, step 1; Chat's side in
// wapi-api docs/api/oauth.md). Tokens and the client secret never leave the
// server.

// Everything Book may ask for; Chat's consent page lists them.
const SCOPES = "contacts automations conversations"
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

// The page the Chat window ends on (app/(owner)/connect/chat), on this site.
export function chatDoneUrl(site: URL, businessId: string, result: ChatConnectResult) {
  const url = new URL("/connect/chat", site)
  url.search = new URLSearchParams({ businessId, result }).toString()
  return url
}

type Attempt = {
  state: string
  verifier: string
  businessId: string
  userId: string
  startedAt: number
}

// The Chat consent URL to open, and the sealed attempt to keep in a cookie.
export function startChatConnect(businessId: string, userId: string) {
  const { clientId, redirectUri, connectUrl } = config()
  const attempt: Attempt = {
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    businessId,
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

async function save(businessId: string, tokens: Tokens) {
  const row = {
    workspaceId: tokens.workspace_id,
    workspaceName: tokens.workspace_name,
    scopes: tokens.scope,
    accessToken: seal(tokens.access_token),
    refreshToken: seal(tokens.refresh_token),
    accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    needsReconnect: false,
  }
  await db
    .insert(chatConnections)
    .values({ businessId, ...row })
    .onConflictDoUpdate({ target: chatConnections.businessId, set: row })
}

// Swaps Chat's one-time code for tokens and saves them. False if Chat said no.
export async function finishChatConnect(
  businessId: string,
  code: string,
  verifier: string
): Promise<boolean> {
  const { redirectUri } = config()
  const answer = await tokenCall({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  })
  if (!answer.ok) return false
  await save(businessId, answer.tokens)
  return true
}

async function needsReconnect(businessId: string) {
  await db
    .update(chatConnections)
    .set({ accessToken: null, refreshToken: null, accessExpiresAt: null, needsReconnect: true })
    .where(eq(chatConnections.businessId, businessId))
}

async function freshAccessToken(businessId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (!row?.accessToken || !row.refreshToken || row.needsReconnect) return null
  if (row.accessExpiresAt && Date.parse(row.accessExpiresAt) - REFRESH_EARLY_MS > Date.now()) {
    return open(row.accessToken)
  }
  const answer = await tokenCall({
    grant_type: "refresh_token",
    refresh_token: open(row.refreshToken),
  })
  if (answer.ok) {
    await save(businessId, answer.tokens)
    return answer.tokens.access_token
  }
  // Too many tries: nothing changed at Chat, so the same token works later.
  if (answer.code === "rate_limited") return null
  // Any other failure, a lost answer included, may have used the refresh
  // token up; Chat cuts the connection if it is ever sent again.
  await needsReconnect(businessId)
  return null
}

// One refresh at a time per business: Chat treats a second use of a refresh
// token as theft and ends the connection. (One server process; several
// would need a shared lock.)
const refreshing = new Map<string, Promise<string | null>>()

// A working access token for Chat's API, refreshed when it is about to run
// out, or null when the business is not connected or must reconnect.
export function chatAccessToken(businessId: string): Promise<string | null> {
  let pending = refreshing.get(businessId)
  if (!pending) {
    pending = freshAccessToken(businessId).finally(() => refreshing.delete(businessId))
    refreshing.set(businessId, pending)
  }
  return pending
}

// What the Integrations screen may know: never a token.
export async function chatConnectionFor(businessId: string): Promise<ChatConnection | null> {
  const [row] = await db
    .select({
      workspaceName: chatConnections.workspaceName,
      needsReconnect: chatConnections.needsReconnect,
    })
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  return row ?? null
}

// Ends the connection at Chat, then forgets it here. Forgetting happens even
// if Chat cannot be reached; the owner can also revoke it in Chat.
export async function endChatConnection(businessId: string) {
  const [row] = await db
    .select({ refreshToken: chatConnections.refreshToken })
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
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
  await db.delete(chatConnections).where(eq(chatConnections.businessId, businessId))
}
