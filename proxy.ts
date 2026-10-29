import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

import { OWNER_LANGUAGE_COOKIE } from "@/features/dashboard/i18n/language"
import {
  isPageLanguage,
  PAGE_LANGUAGE_HEADER,
  pickLanguage,
  type PageLanguage,
} from "@/lib/page-language"

// The language a page is shown in, as its own page picks it: a business,
// home or legal page from ?lang= or the phone's language, the owner area
// from the owner's pick or the phone's language.
function pageLanguage(request: NextRequest): PageLanguage {
  const { pathname, searchParams } = request.nextUrl
  const accept = request.headers.get("accept-language")
  if (
    pathname.startsWith("/b/") ||
    pathname === "/" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return pickLanguage(searchParams.getAll("lang"), accept)
  }
  const picked = request.cookies.get(OWNER_LANGUAGE_COOKIE)?.value
  return isPageLanguage(picked) ? picked : pickLanguage(undefined, accept)
}

// Optimistic cookie check only on the dashboard; every page and action
// still checks the real session itself. Every page gets its language for
// <html lang> (app/layout.tsx).
export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/dashboard") &&
    !getSessionCookie(request)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(url)
  }
  const forwarded = new Headers(request.headers)
  forwarded.set(PAGE_LANGUAGE_HEADER, pageLanguage(request))
  return NextResponse.next({ request: { headers: forwarded } })
}

export const config = {
  // Pages only: not the API, Next's own files or files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
}
