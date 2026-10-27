import { Separator } from "@/components/ui/separator"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import type { OwnerBooking } from "../types"
import { BookingStatusBadge } from "./booking-status-badge"
import { ContactButtons } from "./contact-buttons"

function price(priceMinor: number | null, currency: string): string | null {
  if (priceMinor === null) return null
  return priceMinor === 0 ? "Free" : formatPrice(priceMinor, currency)
}

// One booking: when, what with its extras, the total, the owner's note and
// quick ways to reach the customer.
export function BookingDetails({ booking }: { booking: OwnerBooking }) {
  const total = price(booking.priceMinor, booking.currency)
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {formatDay(booking.date)} · {formatClock(booking.time)} –{" "}
          {formatClock(booking.endTime)}
        </p>
        <BookingStatusBadge status={booking.status} />
      </div>
      <div className="flex flex-col gap-2">
        <p>{booking.serviceName}</p>
        {booking.addons.map((addon, index) => (
          <div
            key={index}
            className="flex justify-between gap-3 text-muted-foreground"
          >
            <span className="min-w-0">+ {addon.name}</span>
            {addon.priceMinor !== null && (
              <span>{price(addon.priceMinor, booking.currency)}</span>
            )}
          </div>
        ))}
        <div className="flex items-start justify-between gap-3 text-muted-foreground">
          <span className="min-w-0">
            {formatDuration(booking.durationMinutes)}
            {booking.teamMemberName && ` · with ${booking.teamMemberName}`}
          </span>
          {total && (
            <span className="font-medium text-foreground">{total}</span>
          )}
        </div>
      </div>
      {booking.note && (
        <>
          <Separator />
          <p className="whitespace-pre-line">{booking.note}</p>
        </>
      )}
      {booking.customerPhone && (
        <>
          <Separator />
          <p className="text-muted-foreground">{booking.customerPhone}</p>
          <ContactButtons phone={booking.customerPhone} />
        </>
      )}
    </div>
  )
}
