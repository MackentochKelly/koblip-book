"use client"

import { useId } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatDayShort, formatMonthDay } from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"
import type { PeriodSummary } from "../utils/analytics"

// The grid always shows a few steps, even with few bookings.
const MIN_TOP = 3

// Bookings per day over the period, stacked: returning customers below,
// new ones on top (shadcn's interactive area chart; the page's tab picks
// the period).
export function BookingsAreaChart({
  daily,
}: {
  daily: PeriodSummary["daily"]
}) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const id = useId().replace(/:/g, "")
  const config = {
    returning: { label: a.returning, color: "var(--chart-2)" },
    newCustomers: { label: a.newCustomers, color: "var(--chart-1)" },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{a.bookings}</CardTitle>
        <CardDescription>{a.newAndReturning}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <AreaChart data={daily} margin={{ left: 0, right: 0, top: 8 }}>
            <defs>
              {(["returning", "newCustomers"] as const).map((key) => (
                <linearGradient
                  key={key}
                  id={`${id}-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(date: string) => formatMonthDay(date, m.locale)}
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
                  indicator="dot"
                  labelFormatter={(_, payload) => {
                    const date = payload[0]?.payload?.date
                    return typeof date === "string"
                      ? formatDayShort(date, m.locale)
                      : ""
                  }}
                />
              }
            />
            <Area
              dataKey="returning"
              type="monotone"
              fill={`url(#${id}-returning)`}
              stroke="var(--color-returning)"
              stackId="bookings"
            />
            <Area
              dataKey="newCustomers"
              type="monotone"
              fill={`url(#${id}-newCustomers)`}
              stroke="var(--color-newCustomers)"
              stackId="bookings"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
