import { Badge } from "@/components/ui/badge"
import { useOwnerMessages } from "../i18n/provider"
import type { BookingStatus } from "../types"

// A booking's status, shown only when it is not the usual "confirmed".
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useOwnerMessages().bookings.status
  const labels: Partial<Record<BookingStatus, string>> = {
    cancelled: t.cancelled,
    completed: t.completed,
    no_show: t.noShow,
  }
  const label = labels[status]
  if (!label) return null
  return (
    <Badge variant={status === "no_show" ? "destructive" : "outline"}>
      {label}
    </Badge>
  )
}
