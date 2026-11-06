import { NextResponse, type NextRequest } from "next/server"

import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { hasFeature } from "@/lib/plan-access"
import { requireAccount } from "@/lib/dal"
import {
  GOOGLE_ATTEMPT_COOKIE,
  GOOGLE_ATTEMPT_COOKIE_PATH,
  GOOGLE_ATTEMPT_MAX_AGE,
  googleCalendarDoneUrl,
  startGoogleCalendarConnect,
} from "@/lib/google-calendar"

// Opened in the Google window by Connect on the Integrations page: remembers
// this attempt in a sealed cookie, then goes to Google's consent page.
export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId") ?? ""
  const session = await requireAccount()
  // Only the business's owner gets past here.
  await getOwnerBusiness(businessId)
  if (!(await hasFeature(businessId, "googleCalendar"))) {
    return NextResponse.redirect(googleCalendarDoneUrl(businessId, "failed"))
  }
  let started: ReturnType<typeof startGoogleCalendarConnect>
  try {
    started = startGoogleCalendarConnect({ businessId, userId: session.userId }, session.email ?? undefined)
  } catch (error) {
    console.error(error)
    return NextResponse.redirect(googleCalendarDoneUrl(businessId, "failed"))
  }
  const response = NextResponse.redirect(started.url)
  response.cookies.set(GOOGLE_ATTEMPT_COOKIE, started.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: sent when Google sends the window back here, never on other sites' calls.
    sameSite: "lax",
    path: GOOGLE_ATTEMPT_COOKIE_PATH,
    maxAge: GOOGLE_ATTEMPT_MAX_AGE,
  })
  return response
}
