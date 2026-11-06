"use client"

import { Area, AreaChart, YAxis } from "recharts"

import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

// A number's days as a thin line with a very faint fill under it, in the
// colour of the text around it (currentColor), from zero at the bottom:
// no axes, grid, labels or tooltip. Only a picture, so the number beside
// it says it in words. Fills its box; `className` sizes it.
export function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const data = values.map((value, day) => ({ day, value }))
  return (
    <ChartContainer
      config={{}}
      className={cn("aspect-auto size-full", className)}
    >
      {/* Room for half the line's width at the top and bottom. */}
      <AreaChart data={data} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
        <YAxis hide domain={[0, (most: number) => Math.max(most, 1)]} />
        <Area
          dataKey="value"
          type="monotone"
          stroke="currentColor"
          strokeWidth={1.5}
          fill="currentColor"
          fillOpacity={0.08}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
