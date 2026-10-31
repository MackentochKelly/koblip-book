import { Badge } from "@/components/ui/badge"
import { useOwnerMessages } from "../i18n/provider"
import type { BookingState } from "../utils/booking-filters"

const VARIANTS = {
  upcoming: "info",
  unmarked: "warning",
  completed: "success",
  no_show: "destructive",
  cancelled: "secondary",
} as const

// Where a booking stands now, in the Bookings page's colours: to come,
// waiting to be marked, done, missed or cancelled.
export function BookingStateBadge({ state }: { state: BookingState }) {
  const t = useOwnerMessages().bookings.list.state
  return <Badge variant={VARIANTS[state]}>{t[state]}</Badge>
}
