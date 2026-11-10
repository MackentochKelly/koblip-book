import { partnerAppFromRequest } from "@/features/partners/api/app-key"
import { createInvite, readInviteInput } from "@/features/partners/api/invites"
import { runInTurn } from "@/lib/run-in-turn"

// POST /api/partner/v1/invites (docs/plans/sales-connection.md, SC1–SC5):
// an approved app asks for an invite link for one Google place.
// Body: { placeId, ref? }. 201 { invite, url }; 400 invalid; 401 no key;
// 409 invite_open (with its id) or already_on_book (with its page);
// 429 daily_cap. The link is shown only in this answer.
const headers = { "cache-control": "no-store" }

export async function POST(request: Request) {
  const app = await partnerAppFromRequest(request)
  if (!app) return Response.json({ error: "unauthorized" }, { status: 401, headers })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "invalid" }, { status: 400, headers })
  }
  const input = readInviteInput(body)
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers })
  // One at a time per app, so its daily cap holds.
  const result = await runInTurn(`partner-invites:${app.id}`, () =>
    createInvite(app, input)
  )
  if (result.ok) {
    return Response.json(
      { invite: result.invite, url: result.url },
      { status: 201, headers }
    )
  }
  switch (result.error) {
    case "invite_open":
      return Response.json({ error: result.error, id: result.id }, { status: 409, headers })
    case "already_on_book":
      return Response.json(
        { error: result.error, pageUrl: result.pageUrl },
        { status: 409, headers }
      )
    case "daily_cap":
      return Response.json({ error: result.error }, { status: 429, headers })
    default:
      return Response.json({ error: result.error }, { status: 400, headers })
  }
}
