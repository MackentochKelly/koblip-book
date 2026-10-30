import { openDemo } from "@/features/demo/api/open-demo"

// POST /api/demo: opens the visitor's own demo copy (features/demo) once
// and answers with where each screen is, so the home page's three demo
// screens all load the same copy as the same guest. 429 when this address
// opened too many new copies lately.
export async function POST(request: Request) {
  const result = await openDemo(request.headers)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 429 })
  }
  const headers = new Headers({ "cache-control": "no-store" })
  for (const cookie of result.setCookies) {
    headers.append("set-cookie", cookie)
  }
  return Response.json({ paths: result.paths }, { headers })
}
