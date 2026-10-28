import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { isCrossSiteRequest } from "@/features/assistant/api/request-guard"
import { transcribeVoice } from "@/features/assistant/api/transcribe"
import type { AssistantStreamEvent } from "@/features/assistant/types"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"

export const runtime = "nodejs"

type ErrorCode = Extract<
  AssistantStreamEvent,
  { type: "error" }
>["code"]

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

  // 2. Rate limit, per owner. Own key so transcribing never eats the
  // chat budget and vice versa.
  if (
    !checkAssistantRateLimit(
      `transcribe:${session.userId}`,
      ASSISTANT_RULES.maxTranscribesPerMinutePerOwner
    )
  ) {
    return Response.json({ error: "rate_limited" satisfies ErrorCode })
  }

  // 3. Multipart shape: businessId text field plus the WAV audio file.
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    form = new FormData()
  }
  const businessId = form.get("businessId")
  const audio = form.get("audio")
  if (typeof businessId !== "string" || !(audio instanceof File)) {
    return Response.json({ error: "bad_request" satisfies ErrorCode }, { status: 400 })
  }
  // Size is known before reading: reject oversized uploads unheard.
  if (audio.size > ASSISTANT_RULES.maxTranscribeBytes) {
    return Response.json({ error: "too_long" satisfies ErrorCode })
  }

  // 4. The business must belong to this owner.
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return Response.json({ error: "not_allowed" satisfies ErrorCode })
  }

  // 5. The owner's language, read once from the cookie (never the body).
  // The transcript comes back for the owner to read and edit; it is sent
  // as a normal chat message afterwards, never executed here.
  const language = await getOwnerLanguage()
  const bytes = new Uint8Array(await audio.arrayBuffer())
  if (bytes.length > ASSISTANT_RULES.maxTranscribeBytes) {
    return Response.json({ error: "too_long" satisfies ErrorCode })
  }
  const result = await transcribeVoice(bytes, language, {
    signal: request.signal,
  })
  if ("code" in result) {
    return Response.json({ error: result.code satisfies ErrorCode })
  }
  return Response.json({ text: result.text })
}
