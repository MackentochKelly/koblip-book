"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { ViewTabs } from "@/components/view-tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { addDaysTo, formatWeekdayShort } from "@/lib/format-booking-time"
import { cn } from "@/lib/utils"
import { type Period, PERIODS, type PeriodSummary } from "../utils/analytics"
import { BookingsAreaChart } from "./bookings-area-chart"
import { ComingUpCard } from "./coming-up-card"
import { PeriodStats } from "./period-stats"
import { ShowUpChart } from "./show-up-chart"
import { TopShares } from "./top-shares"

// A Monday, so the busiest-days bars can be named Monday first.
const A_MONDAY = "2024-01-01"

// Everything about how the business is doing. One tab at the top picks the
// period (7 days, 30 days, 3 months) for all of it: the key numbers against
// the period before, bookings per day, show-ups, top services (and top
// categories once there are categories) and busiest days. Then what is
// coming up. On a phone the top bar names the page.
export function AnalyticsView({
  periods,
  currency,
  comingUp,
}: {
  periods: Record<Period, PeriodSummary>
  currency: string
  comingUp: {
    today: number
    upcoming: number
    days: Array<{ date: string; bookings: number }>
  }
}) {
  const a = useTranslations("owner.bookings.analytics")
  const shell = useTranslations("owner.shell")
  const [period, setPeriod] = useState<`${Period}`>("7")
  const summary = periods[Number(period) as Period]
  const label = a(`last.${period}`)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
          {shell("nav.analytics")}
        </h1>
        <ViewTabs<`${Period}`>
          views={PERIODS.map((days) => ({
            id: `${days}`,
            label: a(`periods.${days}`),
          }))}
          value={period}
          onChange={setPeriod}
          ariaLabel={a("period")}
          listClassName="w-full md:w-fit"
        />
      </div>
      <PeriodStats summary={summary} currency={currency} />
      <BookingsAreaChart daily={summary.daily} />
      {/* Four cards two by two with Top categories, else three in a row. */}
      <div
        className={cn(
          "grid gap-6",
          summary.topCategories ? "lg:grid-cols-2" : "lg:grid-cols-3"
        )}
      >
        <ShowUpChart showUp={summary.showUp} period={label} />
        <TopShares
          title={a("topServices")}
          items={summary.topServices}
          period={label}
        />
        {summary.topCategories && (
          <TopShares
            title={a("topCategories")}
            items={summary.topCategories}
            period={label}
          />
        )}
        <BusiestDays weekdays={summary.weekdays} period={label} />
      </div>
      <ComingUpCard
        today={comingUp.today}
        upcoming={comingUp.upcoming}
        days={comingUp.days}
      />
    </div>
  )
}

// Bookings per weekday over the period, Monday first.
function BusiestDays({
  weekdays,
  period,
}: {
  weekdays: number[]
  period: string
}) {
  const t = useTranslations("owner.bookings")
  const locale = useLocale()
  const config = {
    bookings: { label: t("chart.series"), color: "var(--chart-2)" },
  } satisfies ChartConfig
  const data = weekdays.map((bookings, index) => ({
    day: formatWeekdayShort(addDaysTo(A_MONDAY, index), locale),
    bookings,
  }))
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t("analytics.busiestDays")}</CardTitle>
        <CardDescription>{period}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-end">
        <ChartContainer config={config} className="aspect-auto h-48 w-full">
          <BarChart data={data} margin={{ top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideIndicator />}
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
