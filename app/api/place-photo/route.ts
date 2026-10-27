import type { NextRequest } from "next/server"

const PHOTO_NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/

// Proxies one Google place photo: the photo name is never stored (it can
// expire), so the page asks for it fresh and this route fetches the image
// server-side. The API key never reaches the browser.
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? ""
  if (!PHOTO_NAME_PATTERN.test(name)) {
    return Response.json({ error: "Invalid photo name" }, { status: 400 })
  }
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    return Response.json({ error: "Photo unavailable" }, { status: 502 })
  }
  let res: Response
  try {
    res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1600`,
      {
        headers: { "X-Goog-Api-Key": key },
        cache: "no-store",
      }
    )
  } catch {
    return Response.json({ error: "Photo unavailable" }, { status: 502 })
  }
  if (!res.ok) {
    return Response.json({ error: "Photo unavailable" }, { status: 502 })
  }
  const body = await res.arrayBuffer()
  return new Response(body, {
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  })
}
