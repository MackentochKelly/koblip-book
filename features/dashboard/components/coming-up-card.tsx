"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import { formatDayShort, formatMonthDay } from "@/lib/format-booking-time"

// The grid always shows a few steps, even with no bookings yet.
const MIN_TOP = 3

// What is booked ahead: today, tomorrow, the next 7 days and everything
// upcoming, then confirmed bookings per day for the next 14 days.
// `titled={false}` where a section title above already says it all (Home).
export function ComingUpCard({
  today,
  upcoming,
  days,
  titled = true,
}: {
  titled?: boolean
  today: number
  upcoming: number
  days: Array<{ date: string; bookings: number }>
}) {
  const t = useTranslations("owner.bookings")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale)
  const config = {
    bookings: { label: t("chart.series"), color: "var(--chart-2)" },
  } satisfies ChartConfig
  const counts = [
    { label: t("analytics.today"), value: today },
    { label: t("analytics.tomorrow"), value: days[1]?.bookings ?? 0 },
    {
      label: t("analytics.next7"),
      value: days.slice(0, 7).reduce((sum, day) => sum + day.bookings, 0),
    },
    { label: t("analytics.upcoming"), value: upcoming },
  ]

  return (
    <Card>
      {titled && (
        <CardHeader>
          <CardTitle>{t("analytics.comingUp")}</CardTitle>
          <CardDescription>{t("analytics.nextTwoWeeks")}</CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {counts.map((count) => (
            <div key={count.label} className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{count.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {number.format(count.value)}
              </dd>
            </div>
          ))}
        </dl>
        <ChartContainer config={config} className="aspect-auto h-48 w-full">
          <BarChart data={days} margin={{ left: 0, right: 0, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(date: string) => formatMonthDay(date, locale)}
            />
            <YAxis
              orientation="right"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={24}
              domain={[0, (top: number) => Math.max(top, MIN_TOP)]}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(_, payload) => {
                    const date = payload[0]?.payload?.date
                    return typeof date === "string"
                      ? formatDayShort(date, locale)
                      : ""
                  }}
                />
              }
            />
            <Bar
              dataKey="bookings"
              fill="var(--color-bookings)"
              radius={6}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
