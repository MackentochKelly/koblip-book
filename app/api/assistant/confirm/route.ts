import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { takePendingAction } from "@/features/assistant/api/pending-actions"
import { runPending } from "@/features/assistant/api/run-pending"
import {
  isCrossSiteRequest,
  requestBudget,
} from "@/features/assistant/api/request-guard"
import type {
  AssistantConfirmRequest,
  AssistantStreamEvent,
} from "@/features/assistant/types"
import { serverMessagesFor } from "@/features/assistant/i18n/server"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"
import { buildAssistantTools } from "../tools"

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

function isValidBody(value: unknown): value is AssistantConfirmRequest {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return (
    typeof body.businessId === "string" &&
    typeof body.id === "string" &&
    typeof body.accept === "boolean"
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

  // 3. Body shape. Extra fields are ignored: only id and accept matter.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  if (!isValidBody(body)) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }

  // 4. The business must belong to this owner.
  const owned = await ownedBusiness(body.businessId)
  if (!owned) {
    return errorEvent("not_allowed")
  }

  // 5. The card must belong to this owner and business, and is taken
  // once. A foreign card stays stored; unknown, expired or already taken
  // ones report expired.
  const pending = await takePendingAction(
    body.id,
    session.userId,
    owned.business.id
  )
  if (pending === "expired" || pending === "not_allowed") {
    return errorEvent(pending)
  }

  // The owner's language, read once from the cookie (never the body).
  const language = await getOwnerLanguage()
  const t = serverMessagesFor(language)
  const budget = requestBudget(request)
  const encoder = new TextEncoder()
  const send = (event: AssistantStreamEvent): Uint8Array =>
    encoder.encode(JSON.stringify(event) + "\n")
  const tool = buildAssistantTools(
    owned.business.id,
    session.userId,
    language
  ).find((tool) => tool.definition.name === pending.toolName)
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (budget.signal.aborted) {
          return
        }
        if (!body.accept) {
          controller.enqueue(
            send({
              type: "text",
              delta: tool?.confirm?.declinedText ?? t.confirm.unchanged,
            })
          )
          controller.enqueue(send({ type: "done" }))
          return
        }
        for await (const event of runPending(pending, tool, t)) {
          controller.enqueue(send(event))
        }
        controller.enqueue(send({ type: "done" }))
      } finally {
        budget.done()
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: NDJSON_HEADERS })
}
