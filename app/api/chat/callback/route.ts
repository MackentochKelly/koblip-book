import { NextResponse, type NextRequest } from "next/server"

import {
  CHAT_ATTEMPT_COOKIE,
  CHAT_ATTEMPT_COOKIE_PATH,
  attemptAccount,
  chatDoneUrl,
  finishChatConnect,
  readChatAttempt,
} from "@/features/dashboard/api/chat-oauth"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getSession, requireAdmin } from "@/lib/dal"
import type { ChatConnectResult } from "@/types/chat-connect"

// Where Koblip Chat sends the window back: with a one-time code after Allow,
// or error=access_denied after Cancel. The answer counts only for the same
// browser, person and attempt that started it, and only once.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const attempt = readChatAttempt(
    request.cookies.get(CHAT_ATTEMPT_COOKIE)?.value,
    params.get("state")
  )
  const account = attempt ? attemptAccount(attempt) : null
  const session = await getSession()
  let result: ChatConnectResult = "failed"
  if (attempt && account && session?.userId === attempt.userId) {
    // Still this owner's business, or still an admin for Koblip's own.
    if (account === "koblip") await requireAdmin()
    else await getOwnerBusiness(account.businessId)
    const code = params.get("code")
    if (params.get("error") === "access_denied") {
      result = "denied"
    } else if (code) {
      try {
        result = (await finishChatConnect(account, code, attempt.verifier, attempt.userId))
          ? "connected"
          : "failed"
      } catch (error) {
        console.error(error)
      }
    }
  }
  const response = NextResponse.redirect(chatDoneUrl(account ?? { businessId: "" }, result))
  response.cookies.delete({ name: CHAT_ATTEMPT_COOKIE, path: CHAT_ATTEMPT_COOKIE_PATH })
  return response
}
