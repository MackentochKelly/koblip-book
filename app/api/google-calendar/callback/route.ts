import { NextResponse, after, type NextRequest } from "next/server"

import { syncGoogleCalendar } from "@/lib/google-calendar-sync"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getSession } from "@/lib/dal"
import {
  GOOGLE_ATTEMPT_COOKIE,
  GOOGLE_ATTEMPT_COOKIE_PATH,
  finishGoogleCalendarConnect,
  googleCalendarDoneUrl,
  readGoogleCalendarAttempt,
} from "@/lib/google-calendar"
import type { GoogleConnectResult } from "@/types/google-calendar-connect"

// Where Google sends the window back: with a one-time code after Allow, or
// error=access_denied after Cancel. The answer counts only for the same
// browser, person and attempt that started it, and only once.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const attempt = readGoogleCalendarAttempt(
    request.cookies.get(GOOGLE_ATTEMPT_COOKIE)?.value,
    params.get("state")
  )
  const session = await getSession()
  let result: GoogleConnectResult = "failed"
  if (attempt && session?.userId === attempt.userId) {
    // Still this owner's business.
    await getOwnerBusiness(attempt.businessId)
    const code = params.get("code")
    if (params.get("error") === "access_denied") {
      result = "denied"
    } else if (code) {
      try {
        const finished = await finishGoogleCalendarConnect(attempt, code)
        result = finished.result
        // The calendar and its events right away, not at the next tick.
        const { connectionId } = finished
        if (connectionId) after(() => syncGoogleCalendar(connectionId))
      } catch (error) {
        console.error(error)
      }
    }
  }
  const response = NextResponse.redirect(googleCalendarDoneUrl(attempt?.businessId ?? "", result))
  response.cookies.delete({ name: GOOGLE_ATTEMPT_COOKIE, path: GOOGLE_ATTEMPT_COOKIE_PATH })
  return response
}
