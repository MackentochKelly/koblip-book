import { clientFeedFor } from "@/features/notifications/api/client-queries"
import { getCustomer } from "@/lib/customer-dal"

// GET /api/account/notifications[?cursor=…]: the client's unread count and
// a page of their notifications, newest first, for the client area's bell
// (docs/plans/client-account.md, D10). Never cached: each answer is the
// account's own and current.
export async function GET(request: Request) {
  const customer = await getCustomer()
  const headers = { "cache-control": "private, no-store" }
  if (!customer)
    return Response.json({ error: "unauthorized" }, { status: 401, headers })
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined
  return Response.json(await clientFeedFor(customer, cursor), { headers })
}
