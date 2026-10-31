"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { StatStrip } from "@/components/stat-strip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import {
  CalendarDaysIcon,
  CalendarIcon,
  ClockIcon,
  OctagonXIcon,
  SmileIcon,
  SunIcon,
  UsersIcon,
} from "@/components/ui/icons"
import { addDaysTo, formatWeekdayShort } from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"
import type { DashboardSummary } from "../utils/analytics"
import { BookingsChart } from "./bookings-chart"
import { TopServices } from "./top-services"
import { WeekStats } from "./week-stats"

// A Monday, so the busiest-days bars can be named Monday first.
const A_MONDAY = "2024-01-01"

// Everything about how the business is doing: the last 7 days against the
// week before, what is coming up, the days ahead, the most booked services,
// then the last 30 days (busiest days and who came). On a phone the top bar
// names the page.
export function AnalyticsView({
  counts,
  nextDays,
  summary,
  currency,
}: {
  counts: { today: number; upcoming: number }
  nextDays: Array<{ date: string; bookings: number }>
  summary: DashboardSummary
  currency: string
}) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const number = new Intl.NumberFormat(m.locale)
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
        {m.shell.nav.analytics}
      </h1>
      <WeekStats summary={summary} currency={currency} />
      <StatStrip
        stats={[
          {
            icon: <SunIcon />,
            label: a.today,
            value: number.format(counts.today),
          },
          {
            icon: <CalendarIcon />,
            label: a.tomorrow,
            value: number.format(nextDays[1]?.bookings ?? 0),
          },
          {
            icon: <CalendarDaysIcon />,
            label: a.next7,
            value: number.format(
              nextDays.slice(0, 7).reduce((sum, day) => sum + day.bookings, 0)
            ),
          },
          {
            icon: <ClockIcon />,
            label: a.upcoming,
            value: number.format(counts.upcoming),
          },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <BookingsChart days={nextDays} />
        </div>
        <div className="flex min-w-0 lg:col-span-2 [&>*]:flex-1">
          <TopServices services={summary.topServices} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <BusiestDays weekdays={summary.weekdays} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <StatStrip
            columns={2}
            stats={[
              {
                icon: <CalendarIcon />,
                label: a.bookings,
                value: number.format(summary.last30.bookings),
                note: a.last30,
              },
              {
                icon: <OctagonXIcon />,
                label: a.noShows,
                value: number.format(summary.last30.noShows),
                note: a.last30,
              },
              {
                icon: <SmileIcon />,
                label: a.newCustomers,
                value: number.format(summary.last30.newCustomers),
                note: a.last30,
              },
              {
                icon: <UsersIcon />,
                label: a.returning,
                value: number.format(summary.last30.returning),
                note: a.last30,
              },
            ]}
          />
        </div>
      </div>
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{a.busiestDays}</CardTitle>
        <CardDescription>{a.last30}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
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
