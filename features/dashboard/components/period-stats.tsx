"use client"

import { StatStrip } from "@/components/stat-strip"
import {
  BanknoteIcon,
  CalendarIcon,
  CalendarX2Icon,
  UserPlusIcon,
} from "@/components/ui/icons"
import { Money } from "@/components/money"
import { useOwnerMessages } from "../i18n/provider"
import { type PeriodSummary, percentChange } from "../utils/analytics"

// A period's bookings, revenue, new customers and no-shows (fewer is
// better), each against the period before. Home shows the last 7 days and
// opens Analytics; Analytics shows the period its tab picks.
export function PeriodStats({
  summary,
  currency,
  href,
  bookingsHref,
}: {
  summary: PeriodSummary
  currency: string
  href?: string
  // Where the Bookings number opens instead (Home: the Bookings page).
  bookingsHref?: string
}) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const number = new Intl.NumberFormat(m.locale)
  return (
    <StatStrip
      href={href}
      stats={[
        {
          icon: <CalendarIcon />,
          tone: "primary",
          label: a.bookings,
          href: bookingsHref,
          value: number.format(summary.bookings.current),
          change: percentChange(summary.bookings),
        },
        {
          icon: <BanknoteIcon />,
          tone: "success",
          label: a.revenue,
          value: (
            <Money
              priceMinor={summary.revenue.current}
              currency={currency}
              locale={m.locale}
            />
          ),
          change: percentChange(summary.revenue),
        },
        {
          icon: <UserPlusIcon />,
          tone: "info",
          label: a.newCustomers,
          value: number.format(summary.newCustomers.current),
          change: percentChange(summary.newCustomers),
        },
        {
          icon: <CalendarX2Icon />,
          tone: "destructive",
          label: a.noShows,
          value: number.format(summary.noShows.current),
          change: percentChange(summary.noShows),
          upIsGood: false,
        },
      ]}
    />
  )
}
