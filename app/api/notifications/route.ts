import { feedFor } from "@/features/notifications/api/queries"
import { getSession } from "@/lib/dal"

// GET /api/notifications[?cursor=…]: the owner's unread count and a page of
// notifications, newest first, for the bell to ask on a timer (client-side
// data fetching against a Route Handler, docs/plans/in-app-notifications.md,
// N-D3). Never cached: each answer is the owner's own and current.
export async function GET(request: Request) {
  const session = await getSession()
  const headers = { "cache-control": "private, no-store" }
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401, headers })
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined
  return Response.json(await feedFor(session.userId, cursor), { headers })
}
