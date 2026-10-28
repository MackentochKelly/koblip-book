import { logAssistantAction } from "@/features/assistant/api/audit-log"
import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import {
  isPendingActionLive,
  peekPendingAction,
  takePendingAction,
} from "@/features/assistant/api/pending-actions"
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

  // 5. The card must belong to this owner and business. A foreign card
  // stays stored; only unknown or expired ones report expired.
  const pending = peekPendingAction(body.id)
  if (!pending || !isPendingActionLive(pending)) {
    if (pending) {
      takePendingAction(body.id)
    }
    return errorEvent("expired")
  }
  if (
    pending.ownerId !== session.userId ||
    pending.businessId !== owned.business.id
  ) {
    return errorEvent("not_allowed")
  }
  takePendingAction(body.id)

  // The owner's language, read once from the cookie (never the body).
  const language = await getOwnerLanguage()
  const t = serverMessagesFor(language)
  const budget = requestBudget(request)
  const encoder = new TextEncoder()
  const send = (event: AssistantStreamEvent): Uint8Array =>
    encoder.encode(JSON.stringify(event) + "\n")
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (budget.signal.aborted) {
          return
        }
        if (!body.accept) {
          controller.enqueue(send({ type: "text", delta: t.confirm.unchanged }))
          controller.enqueue(send({ type: "done" }))
          return
        }
        const tool = buildAssistantTools(
          owned.business.id,
          session.userId,
          language
        ).find((tool) => tool.definition.name === pending.toolName)
        const stepId = pending.id.slice(0, 64)
        controller.enqueue(
          send({
            type: "step",
            id: stepId,
            label: tool?.label ?? t.steps.working,
            status: "running",
          })
        )
        // Only the stored args run. Nothing else from the request body.
        const outcome = tool?.confirm
          ? await tool.confirm.execute(pending.args)
          : { ok: false, doneText: t.confirm.unavailable }
        await logAssistantAction({
          businessId: owned.business.id,
          ownerId: session.userId,
          tool: pending.toolName,
          summary: outcome.doneText,
          status: outcome.ok ? "ok" : "failed",
        })
        controller.enqueue(
          send({
            type: "step",
            id: stepId,
            label: tool?.label ?? t.steps.working,
            status: outcome.ok ? "done" : "failed",
          })
        )
        controller.enqueue(send({ type: "text", delta: outcome.doneText }))
        controller.enqueue(send({ type: "done" }))
      } finally {
        budget.done()
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: NDJSON_HEADERS })
}
