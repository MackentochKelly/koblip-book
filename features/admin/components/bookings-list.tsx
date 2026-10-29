import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { AdminBooking } from "../api/queries"
import type { AdminMessages } from "../i18n"

// The newest bookings across every business, each at its business's own
// clock time.
export function BookingsList({
  bookings,
  m,
}: {
  bookings: AdminBooking[]
  m: AdminMessages
}) {
  const t = m.bookings
  const when = (booking: AdminBooking) =>
    new Intl.DateTimeFormat(m.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: booking.timezone,
    }).format(new Date(booking.startAt))
  return (
    <ItemGroup className="gap-3">
      {bookings.map((booking) => (
        <Item key={booking.id} variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{booking.customerName}</ItemTitle>
            <ItemDescription className="truncate">
              {`${booking.businessName} · ${booking.serviceName} · ${when(booking)}`}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge
              variant={
                booking.status === "no_show"
                  ? "destructive"
                  : booking.status === "confirmed"
                    ? "secondary"
                    : "outline"
              }
            >
              {t.status[booking.status] ?? booking.status}
            </Badge>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
