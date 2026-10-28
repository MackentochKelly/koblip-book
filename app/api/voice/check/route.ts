import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"
import { VOICE_HANDSHAKE } from "@/lib/meta-ai"

export const runtime = "nodejs"

// Internal only: the custom server (server.mjs) calls this with the
// request's cookie before upgrading /api/voice/listen. It answers with
// everything the relay needs and never the Meta key.
export async function GET(request: Request) {
  // 1. Logged-in owner.
  const session = await getSession()
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  // 2. Rate limit, per owner. Own key so voice never eats the other budgets.
  if (
    !checkAssistantRateLimit(
      `voice:${session.userId}`,
      ASSISTANT_RULES.maxVoiceSessionsPerMinutePerOwner
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

  // 4. The owner's language, read once from the cookie (never the body),
  // becomes the transcription language bias.
  const language = await getOwnerLanguage()
  return Response.json({
    handshake: {
      ...VOICE_HANDSHAKE,
      languageBias: [language === "es" ? "Spanish" : "English"],
    },
    maxSessionSeconds: ASSISTANT_RULES.maxVoiceSessionSeconds,
    maxBufferedBytes: ASSISTANT_RULES.voiceMaxBufferedBytes,
    maxFrameBytes: ASSISTANT_RULES.voiceMaxFrameBytes,
  })
}
