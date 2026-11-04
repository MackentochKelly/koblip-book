import "server-only"

import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { isCrossSiteRequest } from "@/features/assistant/api/request-guard"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getSession } from "@/lib/dal"
import { VOICE_RULES } from "@/lib/voice-rules"

export const runtime = "nodejs"

const HOW = new Set(["early", "final", "tap", "hello", "takenBack"])
const MAX_MS = 10 * 60 * 1000

const isMs = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_MS

// Where one spoken answer's time went, written to the server log. Numbers only:
// never the owner's words. Own rate limit, so it never eats the chat's budget.
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
      `voice-timing:${session.userId}`,
      VOICE_RULES.maxTimingReportsPerMinutePerOwner
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
  const { businessId, how, heardMs, firstWordsMs, firstSoundMs } = (
    typeof body === "object" && body !== null ? body : {}
  ) as Record<string, unknown>
  if (
    typeof businessId !== "string" ||
    typeof how !== "string" ||
    !HOW.has(how) ||
    !isMs(heardMs) ||
    !isMs(firstWordsMs) ||
    !isMs(firstSoundMs)
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return Response.json({ error: "not_allowed" }, { status: 403 })
  }
  console.info(
    "voice-timing",
    JSON.stringify({
      how,
      heardMs: Math.round(heardMs),
      firstWordsMs: Math.round(firstWordsMs),
      firstSoundMs: Math.round(firstSoundMs),
      totalMs: Math.round(heardMs + firstSoundMs),
    })
  )
  return new Response(null, { status: 204 })
}
