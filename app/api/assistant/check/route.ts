import {
  answerCheckEvents,
  takeAnswerCheck,
} from "@/features/assistant/api/answer-checks"
import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import {
  isCrossSiteRequest,
  requestBudget,
} from "@/features/assistant/api/request-guard"
import type {
  AssistantCheckRequest,
  AssistantStreamEvent,
} from "@/features/assistant/types"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"

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

function isValidBody(value: unknown): value is AssistantCheckRequest {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return typeof body.businessId === "string" && typeof body.id === "string"
}

// Runs the check a finished answer left behind (the `check` event), and
// streams its outcome for that reply.
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

  // 2. Rate limit, per owner. Own key so checks never eat the asking
  // budget: each answer brings one.
  if (
    !checkAssistantRateLimit(
      `check:${session.userId}`,
      ASSISTANT_RULES.maxRequestsPerMinutePerOwner
    )
  ) {
    return errorEvent("rate_limited")
  }

  // 3. Body shape.
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

  // 5. The check must be this owner's and business's, and still waiting.
  const check = takeAnswerCheck(body.id, session.userId, owned.business.id)
  if (!check) {
    return errorEvent("expired")
  }

  const budget = requestBudget(request)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of answerCheckEvents(check, budget.signal)) {
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
