import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import {
  isCrossSiteRequest,
  requestBudget,
} from "@/features/assistant/api/request-guard"
import { runChat } from "@/features/assistant/api/run-chat"
import type {
  AssistantMessage,
  AssistantStreamEvent,
} from "@/features/assistant/types"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"
import { buildAssistantTools } from "./tools"

export const runtime = "nodejs"

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson",
  "Cache-Control": "no-store",
}

function errorEvent(
  code: Extract<AssistantStreamEvent, { type: "error" }>["code"]
): Response {
  return new Response(JSON.stringify({ type: "error", code }) + "\n", {
    headers: NDJSON_HEADERS,
  })
}

function isValidMessages(value: unknown): value is AssistantMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }
  return value.every(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      ((m as AssistantMessage).role === "owner" ||
        (m as AssistantMessage).role === "assistant") &&
      typeof (m as AssistantMessage).text === "string"
  )
}

export async function POST(request: Request) {
  // 0. Same origin only.
  if (isCrossSiteRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  // 1. Logged-in owner.
  const session = await getSession()
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  // 2. Rate limit, per owner.
  if (
    !checkAssistantRateLimit(
      session.userId,
      ASSISTANT_RULES.maxRequestsPerMinutePerOwner
    )
  ) {
    return errorEvent("rate_limited")
  }

  // 3. Body shape and length.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const businessId =
    typeof body === "object" && body !== null
      ? (body as { businessId?: unknown }).businessId
      : undefined
  const messages =
    typeof body === "object" && body !== null
      ? (body as { messages?: unknown }).messages
      : undefined
  const voice =
    typeof body === "object" && body !== null
      ? (body as { voice?: unknown }).voice
      : undefined
  if (
    typeof businessId !== "string" ||
    !isValidMessages(messages) ||
    (voice !== undefined && typeof voice !== "boolean")
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  if (messages.some((m) => m.text.length > ASSISTANT_RULES.maxMessageChars)) {
    return errorEvent("too_long")
  }

  // 4. The business must belong to this owner.
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return errorEvent("not_allowed")
  }

  // 5. The owner's language, read once from the cookie (never the
  // body), then keep only the newest messages and run the tool loop.
  const language = await getOwnerLanguage()
  const trimmed = messages.slice(-ASSISTANT_RULES.maxHistoryMessages)
  const budget = requestBudget(request)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runChat(
          trimmed,
          {
            businessName: owned.business.name,
            timeZone: owned.business.timezone,
            now: Date.now(),
            ownerId: session.userId,
            businessId: owned.business.id,
            language,
            voice: voice === true,
          },
          buildAssistantTools(owned.business.id, session.userId, language),
          { signal: budget.signal }
        )) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        }
      } finally {
        budget.done()
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: NDJSON_HEADERS })
}
