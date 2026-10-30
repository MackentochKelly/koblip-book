import { NextResponse, type NextRequest } from "next/server"

import {
  CHAT_ATTEMPT_COOKIE,
  CHAT_ATTEMPT_COOKIE_PATH,
  CHAT_ATTEMPT_MAX_AGE,
  chatDoneUrl,
  startChatConnect,
} from "@/features/dashboard/api/chat-oauth"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { requireAccount } from "@/lib/dal"

// Opened in the Chat window by Connect on the Integrations page: remembers
// this attempt in a sealed cookie, then goes to Koblip Chat's consent page.
export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId") ?? ""
  const session = await requireAccount()
  // Only the business's owner gets past here.
  await getOwnerBusiness(businessId)
  let started: ReturnType<typeof startChatConnect>
  try {
    started = startChatConnect(businessId, session.userId)
  } catch (error) {
    console.error(error)
    return NextResponse.redirect(chatDoneUrl(request.nextUrl, businessId, "failed"))
  }
  const response = NextResponse.redirect(started.url)
  response.cookies.set(CHAT_ATTEMPT_COOKIE, started.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: sent when Chat sends the window back here, never on other sites' calls.
    sameSite: "lax",
    path: CHAT_ATTEMPT_COOKIE_PATH,
    maxAge: CHAT_ATTEMPT_MAX_AGE,
  })
  return response
}
