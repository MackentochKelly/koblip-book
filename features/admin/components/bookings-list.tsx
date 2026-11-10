import { useLocale, useTranslations } from "next-intl"

import { PaymentBadge } from "@/components/payment-badge"
import { PaymentProof } from "@/components/payment-proof"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { proofDeleteDate } from "@/lib/payment-rules"
import type { AdminBooking } from "../api/queries"

// A booking's status words, by the statuses a booking has.
const STATUSES = ["confirmed", "completed", "no_show", "cancelled"] as const

// The newest bookings across every business, each at its business's own
// clock time.
export function BookingsList({ bookings }: { bookings: AdminBooking[] }) {
  const t = useTranslations("admin.bookings")
  const locale = useLocale()
  const statusOf = (booking: AdminBooking) => {
    const status = STATUSES.find((item) => item === booking.status)
    return status ? t(`status.${status}`) : booking.status
  }
  const when = (booking: AdminBooking) =>
    new Intl.DateTimeFormat(locale, {
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
              {booking.payment &&
                ` · ${booking.payment.way ?? t("payLater")}`}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {booking.reward && <Badge variant="outline">{t("reward")}</Badge>}
            {booking.payment?.proof && (
              <PaymentProof
                bookingId={booking.id}
                label={t("proof")}
                note={t("proofDeleted", {
                  date: proofDeleteDate(booking.startAt),
                })}
              />
            )}
            {booking.payment && (
              <PaymentBadge
                status={booking.payment.status}
                label={t(`payment.${booking.payment.status}`)}
              />
            )}
            <Badge
              variant={
                booking.status === "no_show"
                  ? "destructive"
                  : booking.status === "confirmed"
                    ? "secondary"
                    : "outline"
              }
            >
              {statusOf(booking)}
            </Badge>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
