import { checkAssistantRateLimit } from "@/features/assistant/api/rate-limit"
import { isCrossSiteRequest } from "@/features/assistant/api/request-guard"
import { listAssistantChats } from "@/features/assistant/api/chats"
import { ownedBusiness } from "@/features/dashboard/api/owned-business"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { getSession } from "@/lib/dal"

export const runtime = "nodejs"

// GET /api/assistant/chats?businessId=… → newest-first summaries.
export async function GET(request: Request): Promise<Response> {
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
    return Response.json({ error: "rate_limited" }, { status: 429 })
  }

  // 3. The business must belong to this owner.
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  const chats = await listAssistantChats(owned.business.id, session.userId)
  return Response.json(chats)
}
