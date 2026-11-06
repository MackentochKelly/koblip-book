"use client"

import { Area, AreaChart, YAxis } from "recharts"

import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

// A number's days as a thin line with a very faint fill under it, in the
// colour of the text around it (currentColor; a tone's TONE_TEXT), from
// zero at the bottom. The line is as light as a tone icon's ring in
// StatStrip (1px, a quarter of the colour):
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
          strokeOpacity={0.25}
          strokeWidth={1}
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
