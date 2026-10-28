import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { isCrossSiteRequest } from "@/features/assistant/api/request-guard"
import {
  deleteAssistantChat,
  getAssistantChat,
  saveAssistantChat,
} from "@/features/assistant/api/chats"
import type { AssistantMessage } from "@/features/assistant/types"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"

export const runtime = "nodejs"

type Props = {
  params: Promise<{ id: string }>
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cleaned messages, or null when the body is invalid. Empty texts are
// dropped; what remains must be 1 to maxSavedMessages items.
function cleanMessages(value: unknown): AssistantMessage[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const messages: AssistantMessage[] = []
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null
    }
    const { role, text } = item as Record<string, unknown>
    if (
      (role !== "owner" && role !== "assistant") ||
      typeof text !== "string" ||
      text.length > ASSISTANT_RULES.maxSavedMessageChars
    ) {
      return null
    }
    const trimmed = text.trim()
    if (trimmed === "") {
      continue
    }
    messages.push({ role, text: trimmed })
  }
  if (
    messages.length < 1 ||
    messages.length > ASSISTANT_RULES.maxSavedMessages
  ) {
    return null
  }
  return messages
}

// Guards shared by every method, in confirm-route order: same origin,
// logged-in owner, rate limit, then the owner's business. Returns the
// session and business, or a response to send instead.
type Guarded =
  | { ok: false; response: Response }
  | {
      ok: true
      session: Exclude<Awaited<ReturnType<typeof getSession>>, null>
      businessId: string
    }

async function guard(
  request: Request,
  businessId: string | null
): Promise<Guarded> {
  if (isCrossSiteRequest(request)) {
    return {
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    }
  }
  const session = await getSession()
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    }
  }
  if (
    !checkAssistantRateLimit(
      `chats:${session.userId}`,
      ASSISTANT_RULES.maxChatRequestsPerMinutePerOwner
    )
  ) {
    return {
      ok: false,
      response: Response.json({ error: "rate_limited" }, { status: 429 }),
    }
  }
  if (!businessId) {
    return {
      ok: false,
      response: Response.json({ error: "bad_request" }, { status: 400 }),
    }
  }
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return {
      ok: false,
      response: Response.json({ error: "not_found" }, { status: 404 }),
    }
  }
  return { ok: true, session, businessId: owned.business.id }
}

// GET /api/assistant/chats/[id]?businessId=… → the chat, or 404.
export async function GET(
  request: Request,
  { params }: Props
): Promise<Response> {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const checked = await guard(request, businessId)
  if (!checked.ok) {
    return checked.response
  }
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const chat = await getAssistantChat(
    id,
    checked.businessId,
    checked.session.userId
  )
  if (!chat) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  return Response.json(chat)
}

// PUT /api/assistant/chats/[id] body { businessId, messages } → 204.
// Creates the chat or replaces its messages; the title never changes.
export async function PUT(
  request: Request,
  { params }: Props
): Promise<Response> {
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const businessId =
    typeof (body as Record<string, unknown> | null)?.businessId === "string"
      ? ((body as Record<string, unknown>).businessId as string)
      : null
  const checked = await guard(request, businessId)
  if (!checked.ok) {
    return checked.response
  }
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const messages = cleanMessages((body as Record<string, unknown>)?.messages)
  if (!messages) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const saved = await saveAssistantChat({
    id,
    businessId: checked.businessId,
    ownerId: checked.session.userId,
    messages,
  })
  if (!saved) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  return new Response(null, { status: 204 })
}

// DELETE /api/assistant/chats/[id]?businessId=… → 204 (404 if missing).
export async function DELETE(
  request: Request,
  { params }: Props
): Promise<Response> {
  const { id } = await params
  const businessId = new URL(request.url).searchParams.get("businessId")
  const checked = await guard(request, businessId)
  if (!checked.ok) {
    return checked.response
  }
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const deleted = await deleteAssistantChat(
    id,
    checked.businessId,
    checked.session.userId
  )
  if (!deleted) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  return new Response(null, { status: 204 })
}
