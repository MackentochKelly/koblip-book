import { applyChatEvent, verifyChatEvent } from "@/features/dashboard/api/chat-events"

// Where Koblip Chat posts its signed app events (wapi-api docs/api/oauth.md,
// "App events"). The signature covers the exact bytes, so they are checked
// before parsing. Any 2xx tells Chat the event arrived; 401 is final.
export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer())
  const verified = verifyChatEvent(
    rawBody,
    request.headers.get("x-koblip-signature"),
    request.headers.get("x-koblip-timestamp")
  )
  if (!verified) return new Response(null, { status: 401 })

  let event: unknown
  try {
    event = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return new Response(null, { status: 400 })
  }
  // A failure here answers 500, which Chat tries again.
  await applyChatEvent(event)
  return new Response(null, { status: 204 })
}
