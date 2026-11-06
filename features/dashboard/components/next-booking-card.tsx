"use client"

import { useLocale, useTranslations } from "next-intl"
import { ChevronRightIcon, ClockIcon } from "@/components/ui/icons"

import { Card, CardContent } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { formatClock, formatDayShort } from "@/lib/format-booking-time"
import type { OwnerBooking } from "../types"

// The Next booking widget: who comes next, when and for what. A tap opens
// the booking, as in the list.
export function NextBookingCard({
  booking,
  onOpen,
}: {
  booking: OwnerBooking | null
  onOpen: (booking: OwnerBooking, at: number) => void
}) {
  const t = useTranslations("owner.widgets")
  const locale = useLocale()
  return (
    <Card>
      <CardContent>
        {booking ? (
          <Item
            variant="muted"
            render={
              <button
                type="button"
                onClick={() => onOpen(booking, Date.now())}
              />
            }
            className="w-full text-left"
          >
            <ItemMedia variant="icon">
              <ClockIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{booking.customerName}</ItemTitle>
              <ItemDescription>
                {formatDayShort(booking.date, locale)} ·{" "}
                {formatClock(booking.time, locale)} · {booking.serviceName}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon />
            </ItemActions>
          </Item>
        ) : (
          <p className="text-muted-foreground">{t("noNext")}</p>
        )}
      </CardContent>
    </Card>
  )
}
