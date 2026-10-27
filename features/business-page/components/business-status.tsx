import { Badge } from "@/components/ui/badge"
import type { Business } from "../types"

// Closed for now or for good (Google's word first), else open now or closed
// now from the business's own hours.
export function BusinessStatus({
  status,
  open,
}: {
  status: Business["status"]
  open: boolean | null
}) {
  if (status === "temporarily_closed") {
    return <Badge variant="outline">Temporarily closed</Badge>
  }
  if (status === "closed") {
    return <Badge variant="destructive">Closed</Badge>
  }
  if (open === null) return null
  return (
    <Badge variant={open ? "secondary" : "outline"}>
      {open ? "Open now" : "Closed now"}
    </Badge>
  )
}
