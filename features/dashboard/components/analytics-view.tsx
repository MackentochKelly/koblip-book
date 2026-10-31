"use client"

import { StatCards } from "@/components/stat-cards"
import { useOwnerMessages } from "../i18n/provider"
import { BookingsChart } from "./bookings-chart"

// The owner's numbers: the home page's counts, then confirmed bookings per
// day ahead. On a phone the top bar names the page.
export function AnalyticsView({
  counts,
  nextDays,
}: {
  counts: { today: number; upcoming: number }
  nextDays: Array<{ date: string; bookings: number }>
}) {
  const m = useOwnerMessages()
  const t = m.bookings.stats
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
        {m.shell.nav.analytics}
      </h1>
      <StatCards
        stats={[
          { label: t.today, value: counts.today },
          { label: t.tomorrow, value: nextDays[1]?.bookings ?? 0 },
          {
            label: t.week,
            value: nextDays
              .slice(0, 7)
              .reduce((sum, day) => sum + day.bookings, 0),
          },
          { label: t.upcoming, value: counts.upcoming },
        ]}
        locale={m.locale}
      />
      <BookingsChart days={nextDays} />
    </div>
  )
}
