"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

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
import { formatDay, formatWeekdayShort } from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"

// Booked visits per day for the next two weeks.
export function BookingsChart({
  days,
}: {
  days: Array<{ date: string; bookings: number }>
}) {
  const m = useOwnerMessages()
  const t = m.bookings.chart
  const config = {
    bookings: { label: t.series, color: "var(--chart-2)" },
  } satisfies ChartConfig
  const total = days.reduce((sum, day) => sum + day.bookings, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.total(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-40 w-full">
          <BarChart accessibilityLayer data={days}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={8}
              tickFormatter={(date: string) =>
                formatWeekdayShort(date, m.locale).charAt(0).toUpperCase()
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload[0] ? formatDay(String(payload[0].payload.date), m.locale) : ""
                  }
                />
              }
            />
            <Bar dataKey="bookings" fill="var(--color-bookings)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
