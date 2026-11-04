import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { isCrossSiteRequest } from "@/features/assistant/api/request-guard"
import {
  writeGreeting,
  writeWaitingLines,
} from "@/features/assistant/api/voice-lines"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"

export const runtime = "nodejs"

// What one talk says around its answers: its hello, or its waiting lines. Same
// guards as the chat, from the same per-owner budget. 503 when the AI could not
// write them: the talk goes on without them.
export async function POST(request: Request) {
  if (isCrossSiteRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }
  const session = await getSession()
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  if (
    !checkAssistantRateLimit(
      session.userId,
      ASSISTANT_RULES.maxRequestsPerMinutePerOwner
    )
  ) {
    return Response.json({ error: "rate_limited" }, { status: 429 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const { businessId, part } = (
    typeof body === "object" && body !== null ? body : {}
  ) as { businessId?: unknown; part?: unknown }
  if (
    typeof businessId !== "string" ||
    (part !== "greeting" && part !== "waiting")
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return Response.json({ error: "not_allowed" }, { status: 403 })
  }
  const context = {
    businessName: owned.business.name,
    timeZone: owned.business.timezone,
    now: Date.now(),
    // The owner's language, read from the cookie (never the body).
    language: await getOwnerLanguage(),
  }
  if (part === "greeting") {
    const greeting = await writeGreeting(context, request.signal)
    return greeting
      ? Response.json({ greeting })
      : Response.json({ error: "unavailable" }, { status: 503 })
  }
  const lines = await writeWaitingLines(context, request.signal)
  return lines
    ? Response.json(lines)
    : Response.json({ error: "unavailable" }, { status: 503 })
}
