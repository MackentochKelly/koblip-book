import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

import { LOGIN_PATH, loginHref, RESET_PASSWORD_PATH } from "@/lib/auth-links"
import {
  languageParam,
  OWNER_LANGUAGE_COOKIE,
  PAGE_LANGUAGE_HEADER,
  pickLanguage,
  pickOwnerLanguage,
  type PageLanguage,
} from "@/lib/page-language"

// The language a page is shown in, as its own page picks it: a business,
// home or legal page from ?lang= or the phone's language, an app area
// (owner, team, client) from the pick made in it or the phone's language.
// The login and new password pages keep the language their link names
// (?lang=) first.
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
  const linked =
    pathname === LOGIN_PATH || pathname === RESET_PASSWORD_PATH
      ? languageParam(searchParams.getAll("lang"))
      : null
  if (linked) return linked
  return pickOwnerLanguage(request.cookies.get(OWNER_LANGUAGE_COOKIE)?.value, accept)
}

// Optimistic cookie check only on the dashboard; every page and action
// still checks the real session itself. Every page gets its language for
// <html lang> (app/layout.tsx).
export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/dashboard") &&
    !getSessionCookie(request)
  ) {
    return NextResponse.redirect(
      new URL(loginHref({ next: request.nextUrl.pathname }), request.nextUrl.href)
    )
  }
  const forwarded = new Headers(request.headers)
  forwarded.set(PAGE_LANGUAGE_HEADER, pageLanguage(request))
  return NextResponse.next({ request: { headers: forwarded } })
}

export const config = {
  // Pages only: not the API, Next's own files or files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
}
