import type { NextRequest } from "next/server"
import { openDemo } from "@/features/demo/api/open-demo"
import { DEMO_VIEWS, type DemoView } from "@/lib/demo-rules"

type Props = {
  params: Promise<{ view: string }>
}

function isDemoView(value: string): value is DemoView {
  return (DEMO_VIEWS as readonly string[]).includes(value)
}

// GET /demo/page | /demo/dashboard | /demo/assistant: opens the visitor's
// own demo copy (features/demo) and sends them to that screen of the real
// app. Never cached: every visitor gets their own.
export async function GET(request: NextRequest, { params }: Props) {
  const { view } = await params
  if (!isDemoView(view)) {
    return new Response(null, { status: 404 })
  }
  const result = await openDemo(view, request.headers)
  if (!result.ok) {
    return new Response(null, { status: 429 })
  }
  // A relative Location (RFC 9110), so it stays on whatever host the
  // visitor used, behind the proxy too.
  const headers = new Headers({
    location: result.path,
    "cache-control": "no-store",
  })
  for (const cookie of result.setCookies) {
    headers.append("set-cookie", cookie)
  }
  return new Response(null, { status: 303, headers })
}
