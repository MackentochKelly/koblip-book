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
import { type PeriodSummary, percentChange } from "../utils/analytics"

// A period's bookings, revenue, new customers and no-shows (fewer is
// better), each against the period before. Home shows the last 7 days and
// opens Analytics; Analytics shows the period its tab picks.
export function PeriodStats({
  summary,
  currency,
  caption,
  href,
}: {
  summary: PeriodSummary
  currency: string
  caption?: string
  href?: string
}) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const number = new Intl.NumberFormat(m.locale)
  return (
    <StatStrip
      caption={caption}
      href={href}
      stats={[
        {
          icon: <CalendarIcon />,
          label: a.bookings,
          value: number.format(summary.bookings.current),
          change: percentChange(summary.bookings),
        },
        {
          icon: <BanknoteIcon />,
          label: a.revenue,
          value: formatMoneyShort(summary.revenue.current, currency, m.locale),
          change: percentChange(summary.revenue),
        },
        {
          icon: <SmileIcon />,
          label: a.newCustomers,
          value: number.format(summary.newCustomers.current),
          change: percentChange(summary.newCustomers),
        },
        {
          icon: <OctagonXIcon />,
          label: a.noShows,
          value: number.format(summary.noShows.current),
          change: percentChange(summary.noShows),
          upIsGood: false,
        },
      ]}
    />
  )
}
