import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import type { BookingStatus } from "../types"

// A booking's status, shown only when it is not the usual "confirmed".
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations("owner.bookings.status")
  const labels: Partial<Record<BookingStatus, string>> = {
    cancelled: t("cancelled"),
    completed: t("completed"),
    no_show: t("noShow"),
  }
  const label = labels[status]
  if (!label) return null
  return (
    <Badge variant={status === "no_show" ? "destructive" : "outline"}>
      {label}
    </Badge>
  )
}
