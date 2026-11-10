"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CalendarDaysIcon } from "@/components/ui/icons"

import { PaymentBadge } from "@/components/payment-badge"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { MyBooking } from "../types"

type View = "upcoming" | "past"

// The statuses that show a badge; a confirmed booking has none.
const BADGES = ["completed", "no_show", "cancelled"] as const

// The team member's own bookings, by day in the business's time zone.
export function MyBookings({
  upcoming,
  past,
  timeZone,
}: {
  upcoming: MyBooking[]
  past: MyBooking[]
  timeZone: string
}) {
  const t = useTranslations("teamArea")
  const locale = useLocale()
  const [view, setView] = useState<View>("upcoming")
  const list = view === "upcoming" ? upcoming : past
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  })
  const clock = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
  const days = new Map<string, MyBooking[]>()
  for (const booking of list) {
    const key = day.format(new Date(booking.startAt))
    days.set(key, [...(days.get(key) ?? []), booking])
  }
  return (
    <div className="flex flex-col gap-6">
      <ViewTabs
        variant="line"
        ariaLabel={t("nav.bookings")}
        views={[
          { id: "upcoming", label: t("bookings.upcoming") },
          { id: "past", label: t("bookings.past") },
        ]}
        value={view}
        onChange={setView}
      />
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDaysIcon />
            </EmptyMedia>
            <EmptyTitle>
              {view === "upcoming" ? t("bookings.emptyUpcoming") : t("bookings.emptyPast")}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        [...days].map(([label, items]) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
            <ItemGroup className="gap-3">
              {items.map((booking) => {
                const badge = BADGES.find((status) => status === booking.status)
                return (
                  <Item key={booking.id} variant="outline">
                    <ItemContent>
                      <ItemTitle>{booking.serviceName}</ItemTitle>
                      <ItemDescription>
                        {clock.formatRange(new Date(booking.startAt), new Date(booking.endAt))}
                        {" · "}
                        {booking.customerName}
                        {booking.payment && (
                          <>
                            {" · "}
                            {booking.payment.way ?? t("bookings.payment.later")}
                          </>
                        )}
                      </ItemDescription>
                    </ItemContent>
                    {(badge || booking.payment) && (
                      <ItemActions>
                        {badge && (
                          <Badge variant="secondary">{t(`bookings.status.${badge}`)}</Badge>
                        )}
                        {booking.payment && (
                          <PaymentBadge
                            status={booking.payment.status}
                            label={t(`bookings.payment.status.${booking.payment.status}`)}
                          />
                        )}
                      </ItemActions>
                    )}
                  </Item>
                )
              })}
            </ItemGroup>
          </section>
        ))
      )}
    </div>
  )
}
