"use client"

import {
  Label,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useOwnerMessages } from "../i18n/provider"
import type { PeriodSummary } from "../utils/analytics"

// Who came and who did not over the period, as a half ring (shadcn's
// stacked radial chart): the share who showed up in the middle.
export function ShowUpChart({
  showUp,
  period,
}: {
  showUp: PeriodSummary["showUp"]
  period: string
}) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const number = new Intl.NumberFormat(m.locale)
  const percent = new Intl.NumberFormat(m.locale, { style: "percent" })
  const total = showUp.showedUp + showUp.noShows
  const config = {
    showedUp: { label: a.showedUp, color: "var(--chart-2)" },
    noShows: { label: a.noShows, color: "var(--destructive)" },
  } satisfies ChartConfig

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{a.showUps}</CardTitle>
        <CardDescription>{period}</CardDescription>
      </CardHeader>
      {total === 0 ? (
        <CardContent className="flex flex-1">
          <Empty className="flex-1 border">
            <EmptyHeader>
              <EmptyTitle>{a.noData}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </CardContent>
      ) : (
        <>
          <CardContent className="flex flex-1 items-center pb-0">
            <ChartContainer
              config={config}
              className="mx-auto aspect-9/5 w-full max-w-64"
            >
              {/* Only the top half is drawn, so the box is cut to it with
                  the centre low enough for the label underneath. */}
              <RadialBarChart
                data={[showUp]}
                cy="80%"
                endAngle={180}
                innerRadius={80}
                outerRadius={110}
              >
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox && "cy" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) - 16}
                            className="fill-foreground text-3xl font-semibold"
                          >
                            {percent.format(showUp.showedUp / total)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 6}
                            className="fill-muted-foreground"
                          >
                            {a.showedUp}
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </PolarRadiusAxis>
                <RadialBar
                  dataKey="noShows"
                  stackId="split"
                  cornerRadius={5}
                  fill="var(--color-noShows)"
                  className="stroke-transparent stroke-2"
                />
                <RadialBar
                  dataKey="showedUp"
                  stackId="split"
                  cornerRadius={5}
                  fill="var(--color-showedUp)"
                  className="stroke-transparent stroke-2"
                />
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="justify-center text-muted-foreground">
            {a.showUpSplit(
              number.format(showUp.showedUp),
              number.format(showUp.noShows)
            )}
          </CardFooter>
        </>
      )}
    </Card>
  )
}
