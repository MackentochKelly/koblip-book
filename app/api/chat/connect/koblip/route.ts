import { NextResponse } from "next/server"

import {
  CHAT_ATTEMPT_COOKIE,
  CHAT_ATTEMPT_COOKIE_PATH,
  CHAT_ATTEMPT_MAX_AGE,
  chatDoneUrl,
  startChatConnect,
} from "@/features/dashboard/api/chat-oauth"
import { requireAdmin } from "@/lib/dal"

// Opened in the Chat window by an admin: connects Koblip's own Koblip Chat
// workspace, the number every business sends from until it connects its own
// (K1). Same flow as a business's connection (../route.ts).
export async function GET() {
  const session = await requireAdmin()
  let started: ReturnType<typeof startChatConnect>
  try {
    started = startChatConnect("koblip", session.userId)
  } catch (error) {
    console.error(error)
    return NextResponse.redirect(chatDoneUrl("koblip", "failed"))
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
