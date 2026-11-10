import { partnerAppFromRequest } from "@/features/partners/api/app-key"
import { readInvite } from "@/features/partners/api/invites"

// GET /api/partner/v1/invites/:inviteId (docs/plans/sales-connection.md,
// SC1): one of the app's own invites and what happened to it. Another
// app's is not found.
const headers = { "cache-control": "no-store" }

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/partner/v1/invites/[inviteId]">
) {
  const app = await partnerAppFromRequest(request)
  if (!app) return Response.json({ error: "unauthorized" }, { status: 401, headers })
  const { inviteId } = await params
  const invite = await readInvite(app, inviteId)
  if (!invite) return Response.json({ error: "not_found" }, { status: 404, headers })
  return Response.json({ invite }, { headers })
}
