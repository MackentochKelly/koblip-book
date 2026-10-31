"use client"

import {
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { cn } from "cn"

const config = {
  value: { label: "Value", color: "var(--chart-2)" },
} satisfies ChartConfig

// A ring that fills clockwise from the top as `value` reaches `max`, with a
// big number and a short label in the middle (shadcn's radial chart with
// text). An empty ring when max is 0.
export function RadialProgress({
  value,
  max,
  number,
  label,
  className,
}: {
  value: number
  max: number
  number: string
  label: string
  className?: string
}) {
  return (
    <ChartContainer
      config={config}
      className={cn("aspect-square size-40", className)}
    >
      <RadialBarChart
        data={[{ value: Math.min(value, max), fill: "var(--color-value)" }]}
        startAngle={90}
        endAngle={-270}
        innerRadius="82%"
        outerRadius="100%"
      >
        <PolarAngleAxis
          type="number"
          domain={[0, Math.max(max, 1)]}
          tick={false}
          axisLine={false}
        />
        <RadialBar dataKey="value" background cornerRadius={999} />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) =>
              viewBox && "cx" in viewBox && "cy" in viewBox ? (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 4}
                    className="fill-foreground text-4xl font-semibold tabular-nums"
                  >
                    {number}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 26}
                    className="fill-muted-foreground text-sm"
                  >
                    {label}
                  </tspan>
                </text>
              ) : null
            }
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  )
}
