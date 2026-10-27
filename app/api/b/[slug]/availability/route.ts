import type { NextRequest } from "next/server"
import { getAvailability } from "@/features/booking/api/get-availability"

type Props = {
  params: Promise<{ slug: string }>
}

// GET ?serviceId=…&teamMemberId=…&addons=id1,id2 (teamMemberId missing or
// "any" = anyone; addons is optional, at most 50 ids).
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const searchParams = request.nextUrl.searchParams
  const serviceId = searchParams.get("serviceId")
  if (!serviceId) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const teamMemberParam = searchParams.get("teamMemberId")
  const teamMemberId =
    teamMemberParam === null || teamMemberParam === "any"
      ? null
      : teamMemberParam

  const addonsParam = searchParams.get("addons")
  const addonIds =
    addonsParam === null || addonsParam === ""
      ? []
      : addonsParam
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id !== "")
  if (addonIds.length > 50) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  const result = await getAvailability(slug, serviceId, teamMemberId, addonIds)
  if (!result) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  })
}
