import { NextResponse, after, type NextRequest } from "next/server"

import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getSession } from "@/lib/dal"
import {
  GOOGLE_ATTEMPT_COOKIE,
  GOOGLE_ATTEMPT_COOKIE_PATH,
  finishGoogleCalendarConnect,
  googleCalendarDoneUrl,
  readGoogleCalendarAttempt,
  teamCalendarDoneUrl,
} from "@/lib/google-calendar"
import { googleInviteReady, markGoogleInviteUsed } from "@/lib/google-calendar-invites"
import { syncGoogleCalendar } from "@/lib/google-calendar-sync"
import type { GoogleConnectResult } from "@/types/google-calendar-connect"

// Where Google sends the browser back: with a one-time code after Allow, or
// error=access_denied after Cancel. The answer counts only for the same
// browser and attempt that started it, and only once: for the owner, the
// same signed-in person; for a team member, a link still unused (G5).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const attempt = readGoogleCalendarAttempt(
    request.cookies.get(GOOGLE_ATTEMPT_COOKIE)?.value,
    params.get("state")
  )
  let result: GoogleConnectResult = "failed"
  let allowed = false
  if (attempt && "inviteId" in attempt) {
    allowed = await googleInviteReady(attempt.inviteId)
  } else if (attempt) {
    allowed = (await getSession())?.userId === attempt.userId
    // Still this owner's business.
    if (allowed) await getOwnerBusiness(attempt.businessId)
  }
  if (attempt && allowed) {
    const code = params.get("code")
    if (params.get("error") === "access_denied") {
      result = "denied"
    } else if (code) {
      try {
        const finished = await finishGoogleCalendarConnect(attempt, code)
        result = finished.result
        if (result === "connected" && "inviteId" in attempt) {
          await markGoogleInviteUsed(attempt.inviteId)
        }
        // The calendar and its events right away, not at the next tick.
        const { connectionId } = finished
        if (connectionId) after(() => syncGoogleCalendar(connectionId))
      } catch (error) {
        console.error(error)
      }
    }
  }
  const done =
    attempt && "inviteId" in attempt
      ? teamCalendarDoneUrl(allowed ? result : "expired")
      : googleCalendarDoneUrl(attempt?.businessId ?? "", result)
  const response = NextResponse.redirect(done)
  response.cookies.delete({ name: GOOGLE_ATTEMPT_COOKIE, path: GOOGLE_ATTEMPT_COOKIE_PATH })
  return response
}
