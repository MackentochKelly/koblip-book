"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

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
} from "@/components/ui/chart"
import { ViewTabs } from "@/components/view-tabs"
import {
  dayOfMonth,
  formatDay,
  formatDayRange,
  formatWeekdayShort,
} from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"

type Range = "7" | "14"

// The grid always shows a few steps, even with no bookings yet.
const MIN_TOP = 3

// Booked visits per day ahead, like the iPhone's Health charts: a week or
// two, the total in big numbers, and tapping a bar shows that day's count
// in its place.
export function BookingsChart({
  days,
}: {
  days: Array<{ date: string; bookings: number }>
}) {
  const m = useOwnerMessages()
  const t = m.bookings.chart
  const [range, setRange] = useState<Range>("7")
  const [active, setActive] = useState<number | null>(null)
  const config = {
    bookings: { label: t.series, color: "var(--chart-2)" },
  } satisfies ChartConfig

  const shown = days.slice(0, Number(range))
  const picked = active === null ? undefined : shown[active]
  const count = picked
    ? picked.bookings
    : shown.reduce((sum, day) => sum + day.bookings, 0)
  const first = shown[0]?.date
  const last = shown.at(-1)?.date
  const when = picked
    ? formatDay(picked.date, m.locale)
    : first && last
      ? formatDayRange(first, last, m.locale)
      : ""
  const point = (state: { activeTooltipIndex?: number | string | null }) =>
    setActive(
      state.activeTooltipIndex == null ? null : Number(state.activeTooltipIndex)
    )

  return (
    <Card>
      <CardHeader className="gap-4">
        <ViewTabs<Range>
          views={[
            { id: "7", label: t.week },
            { id: "14", label: t.twoWeeks },
          ]}
          value={range}
          onChange={(next) => {
            setRange(next)
            setActive(null)
          }}
          ariaLabel={t.range}
          listClassName="w-full"
        />
        <div className="flex flex-col gap-1">
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {count}{" "}
            <span className="text-base font-normal text-muted-foreground">
              {t.unit(count)}
            </span>
          </CardTitle>
          <CardDescription aria-live="polite">{when}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-48 w-full">
          <BarChart
            accessibilityLayer
            data={shown}
            margin={{ left: 0, right: 0, top: 4 }}
            onMouseMove={point}
            onClick={point}
            onMouseLeave={() => setActive(null)}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={range === "7" ? 0 : "preserveStartEnd"}
              minTickGap={12}
              tickFormatter={(date: string) =>
                range === "7"
                  ? formatWeekdayShort(date, m.locale)
                  : String(dayOfMonth(date))
              }
            />
            <YAxis
              orientation="right"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={24}
              domain={[0, (top: number) => Math.max(top, MIN_TOP)]}
            />
            {/* No box: the number above changes instead. */}
            <ChartTooltip cursor={false} content={() => null} />
            <Bar dataKey="bookings" radius={6} maxBarSize={32}>
              {shown.map((day, index) => (
                <Cell
                  key={day.date}
                  fill="var(--color-bookings)"
                  fillOpacity={active === null || active === index ? 1 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
