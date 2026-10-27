import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Optimistic cookie check only; every page and action still checks the
// real session itself.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
