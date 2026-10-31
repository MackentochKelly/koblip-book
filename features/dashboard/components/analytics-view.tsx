"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { StatCards } from "@/components/stat-cards"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { addDaysTo, formatWeekdayShort } from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"
import type { AnalyticsSummary } from "../utils/analytics"
import { BookingsChart } from "./bookings-chart"

// A Monday, so the busiest-days bars can be named Monday first.
const A_MONDAY = "2024-01-01"

// The owner's numbers: the home page's counts and confirmed bookings per
// day ahead, then the last 30 days (counts, busiest days, top services). On
// a phone the top bar names the page.
export function AnalyticsView({
  counts,
  nextDays,
  summary,
}: {
  counts: { today: number; upcoming: number }
  nextDays: Array<{ date: string; bookings: number }>
  summary: AnalyticsSummary
}) {
  const m = useOwnerMessages()
  const t = m.bookings.stats
  const a = m.bookings.analytics
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

      <section className="flex flex-col gap-3" aria-labelledby="last-30">
        <h2 id="last-30" className="text-sm font-medium text-muted-foreground">
          {a.last30}
        </h2>
        <StatCards
          stats={[
            { label: a.bookings, value: summary.bookings },
            { label: a.noShows, value: summary.noShows },
            { label: a.newCustomers, value: summary.newCustomers },
            { label: a.returning, value: summary.returningCustomers },
          ]}
          locale={m.locale}
        />
      </section>

      {summary.bookings === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{a.noData}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <BusiestDays weekdays={summary.weekdays} />
          <TopServices services={summary.topServices} />
        </div>
      )}
    </div>
  )
}

// Bookings per weekday over the last 30 days, Monday first.
function BusiestDays({ weekdays }: { weekdays: number[] }) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const config = {
    bookings: { label: m.bookings.chart.series, color: "var(--chart-2)" },
  } satisfies ChartConfig
  const data = weekdays.map((bookings, index) => ({
    day: formatWeekdayShort(addDaysTo(A_MONDAY, index), m.locale),
    bookings,
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{a.busiestDays}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-48 w-full">
          <BarChart accessibilityLayer data={data} margin={{ top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
            />
            <Bar
              dataKey="bookings"
              fill="var(--color-bookings)"
              radius={6}
              maxBarSize={32}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// The most booked services over the last 30 days, each bar against the top.
function TopServices({
  services,
}: {
  services: Array<{ name: string; count: number }>
}) {
  const m = useOwnerMessages()
  const number = new Intl.NumberFormat(m.locale)
  const top = services[0]?.count ?? 1
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.bookings.analytics.topServices}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {services.map((service) => (
          <Progress key={service.name} value={(service.count / top) * 100}>
            <ProgressLabel>{service.name}</ProgressLabel>
            <ProgressValue>{() => number.format(service.count)}</ProgressValue>
          </Progress>
        ))}
      </CardContent>
    </Card>
  )
}
