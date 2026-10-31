"use client"

import { StatStrip } from "@/components/stat-strip"
import {
  BanknoteIcon,
  CalendarIcon,
  OctagonXIcon,
  SmileIcon,
} from "@/components/ui/icons"
import { formatMoneyShort } from "@/lib/format-price"
import { useOwnerMessages } from "../i18n/provider"
import { type DashboardSummary, percentChange } from "../utils/analytics"

// The last 7 days against the week before: bookings, revenue, new
// customers and no-shows (fewer is better). Home and Analytics both lead
// with it; on Home it opens Analytics.
export function WeekStats({
  summary,
  currency,
  href,
}: {
  summary: DashboardSummary
  currency: string
  href?: string
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
          label: a.bookings,
          value: number.format(summary.bookings.current),
          note: a.last7,
          change: percentChange(summary.bookings),
        },
        {
          icon: <BanknoteIcon />,
          label: a.revenue,
          value: formatMoneyShort(summary.revenue.current, currency, m.locale),
          note: a.last7,
          change: percentChange(summary.revenue),
        },
        {
          icon: <SmileIcon />,
          label: a.newCustomers,
          value: number.format(summary.newCustomers.current),
          note: a.last7,
          change: percentChange(summary.newCustomers),
        },
        {
          icon: <OctagonXIcon />,
          label: a.noShows,
          value: number.format(summary.noShows.current),
          note: a.last7,
          change: percentChange(summary.noShows),
          upIsGood: false,
        },
      ]}
    />
  )
}
