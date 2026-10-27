import { Badge } from "@/components/ui/badge"
import type { BookingStatus } from "../types"

const LABELS: Partial<Record<BookingStatus, string>> = {
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
}

// A booking's status, shown only when it is not the usual "confirmed".
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const label = LABELS[status]
  if (!label) return null
  return (
    <Badge variant={status === "no_show" ? "destructive" : "outline"}>
      {label}
    </Badge>
  )
}
