import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
    return (
      <Badge
        variant="outline"
        className="border-warning/20 bg-warning/10 text-warning"
      >
        Temporarily closed
      </Badge>
    )
  }
  if (status === "closed") {
    return <Badge variant="destructive">Closed</Badge>
  }
  if (open === null) return null
  return (
    <Badge
      variant="outline"
      className={cn(open && "border-success/20 bg-success/10 text-success")}
    >
      {open ? "Open now" : "Closed now"}
    </Badge>
  )
}
