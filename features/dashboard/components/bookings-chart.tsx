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

const config = {
  bookings: { label: "Bookings", color: "var(--chart-2)" },
} satisfies ChartConfig

// Booked visits per day for the next two weeks.
export function BookingsChart({
  days,
}: {
  days: Array<{ date: string; bookings: number }>
}) {
  const total = days.reduce((sum, day) => sum + day.bookings, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next 14 days</CardTitle>
        <CardDescription>
          {total} {total === 1 ? "booking" : "bookings"}
        </CardDescription>
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
                formatWeekdayShort(date).charAt(0)
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload[0] ? formatDay(String(payload[0].payload.date)) : ""
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
