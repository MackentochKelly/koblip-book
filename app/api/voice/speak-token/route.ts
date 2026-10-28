import "server-only"

import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { isCrossSiteRequest } from "@/features/assistant/api/request-guard"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getSession } from "@/lib/dal"
import { VOICE_RULES } from "@/lib/voice-rules"

export const runtime = "nodejs"

// Mints a one-time Text to Dialogue token so the browser can open the
// speaking socket directly. The ElevenLabs key never leaves the server,
// and neither does the token except to the checked owner, once.
export async function GET(request: Request) {
  // 0. Same origin only.
  if (isCrossSiteRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  // 1. Logged-in owner.
  const session = await getSession()
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  // 2. Rate limit, per owner. Own key so speaking never eats the budgets.
  if (
    !checkAssistantRateLimit(
      `speak:${session.userId}`,
      VOICE_RULES.maxSpeakTokensPerMinutePerOwner
    )
  ) {
    return Response.json({ error: "rate_limited" }, { status: 429 })
  }

  // 3. The business must belong to this owner.
  const businessId = new URL(request.url).searchParams.get("businessId")
  const owned = businessId ? await ownedBusiness(businessId) : null
  if (!owned) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  // 4. Mint the token server-side. The type below opens the TTD socket
  // (proven live; the token docs page does not list it yet).
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return Response.json({ error: "unavailable" }, { status: 503 })
  }
  let mint: Response
  try {
    mint = await fetch(
      `${VOICE_RULES.speakTokenUrl}${VOICE_RULES.speakTokenType}`,
      { method: "POST", headers: { "xi-api-key": apiKey } }
    )
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 })
  }
  if (!mint.ok) {
    return Response.json({ error: "unavailable" }, { status: 502 })
  }
  const { token } = (await mint.json()) as { token?: unknown }
  if (typeof token !== "string" || token === "") {
    return Response.json({ error: "unavailable" }, { status: 502 })
  }
  const url = new URL(VOICE_RULES.speakSocketUrl)
  url.searchParams.set("model_id", VOICE_RULES.speakModel)
  url.searchParams.set("output_format", VOICE_RULES.speakOutputFormat)
  url.searchParams.set("single_use_token", token)
  return Response.json({ url: url.toString(), voiceId: VOICE_RULES.speakVoiceId })
}
