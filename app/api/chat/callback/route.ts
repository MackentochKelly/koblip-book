import { NextResponse, type NextRequest } from "next/server"

import {
  CHAT_ATTEMPT_COOKIE,
  CHAT_ATTEMPT_COOKIE_PATH,
  chatDoneUrl,
  finishChatConnect,
  readChatAttempt,
} from "@/features/dashboard/api/chat-oauth"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import type { ChatConnectResult } from "@/features/dashboard/types/chat-connection"
import { getSession } from "@/lib/dal"

// Where Koblip Chat sends the window back: with a one-time code after Allow,
// or error=access_denied after Cancel. The answer counts only for the same
// browser, owner and attempt that started it, and only once.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const attempt = readChatAttempt(
    request.cookies.get(CHAT_ATTEMPT_COOKIE)?.value,
    params.get("state")
  )
  const session = await getSession()
  let result: ChatConnectResult = "failed"
  if (attempt && session?.userId === attempt.userId) {
    // Still this owner's business.
    await getOwnerBusiness(attempt.businessId)
    const code = params.get("code")
    if (params.get("error") === "access_denied") {
      result = "denied"
    } else if (code) {
      try {
        result = (await finishChatConnect(attempt.businessId, code, attempt.verifier))
          ? "connected"
          : "failed"
      } catch (error) {
        console.error(error)
      }
    }
  }
  const response = NextResponse.redirect(
    chatDoneUrl(attempt?.businessId ?? "", result)
  )
  response.cookies.delete({ name: CHAT_ATTEMPT_COOKIE, path: CHAT_ATTEMPT_COOKIE_PATH })
  return response
}
