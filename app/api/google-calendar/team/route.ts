import { NextResponse, type NextRequest } from "next/server"

import {
  GOOGLE_ATTEMPT_COOKIE,
  GOOGLE_ATTEMPT_COOKIE_PATH,
  GOOGLE_ATTEMPT_MAX_AGE,
  startGoogleCalendarConnect,
  teamCalendarDoneUrl,
} from "@/lib/google-calendar"
import { readGoogleInvite } from "@/lib/google-calendar-invites"

// Connect on a team member's link page (G5): the link's token is the only
// key, no account. Remembers this attempt in a sealed cookie, then goes to
// Google's consent page.
export async function GET(request: NextRequest) {
  const invite = await readGoogleInvite(request.nextUrl.searchParams.get("invite") ?? "")
  if (!invite || invite.state !== "ready") {
    return NextResponse.redirect(teamCalendarDoneUrl("expired"))
  }
  let started: ReturnType<typeof startGoogleCalendarConnect>
  try {
    started = startGoogleCalendarConnect({
      businessId: invite.businessId,
      teamMemberId: invite.teamMemberId,
      inviteId: invite.id,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.redirect(teamCalendarDoneUrl("failed"))
  }
  const response = NextResponse.redirect(started.url)
  response.cookies.set(GOOGLE_ATTEMPT_COOKIE, started.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: sent when Google sends the browser back here, never on other sites' calls.
    sameSite: "lax",
    path: GOOGLE_ATTEMPT_COOKIE_PATH,
    maxAge: GOOGLE_ATTEMPT_MAX_AGE,
  })
  return response
}
