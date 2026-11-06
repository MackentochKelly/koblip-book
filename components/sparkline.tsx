"use client"

import { Area, AreaChart, YAxis } from "recharts"

import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

// How round the line's corners are: 0 is straight lines from day to day,
// 1 fully round (each corner a curve from the middle of one stretch to the
// middle of the next).
const ROUNDNESS = 0.8

// A curve for Recharts (d3's curve interface, github.com/d3/d3-shape#curves):
// the straight line through the days with each corner rounded by
// `roundness`. Each corner is a quadratic curve inside the corner's own
// triangle, so the line never overshoots or dips below zero, and the first
// and last days stay exact.
function roundedCorners(roundness: number) {
  return (
    context: Pick<
      CanvasPath,
      "moveTo" | "lineTo" | "quadraticCurveTo" | "closePath"
    >
  ) => {
    // As d3's own curves: an area draws its top, then its bottom, as lines.
    let line = NaN
    let count = 0
    let x0 = 0
    let y0 = 0
    let x1 = 0
    let y1 = 0
    return {
      areaStart() {
        line = 0
      },
      areaEnd() {
        line = NaN
      },
      lineStart() {
        count = 0
      },
      lineEnd() {
        if (count > 1) context.lineTo(x1, y1)
        if (line || (line !== 0 && count === 1)) context.closePath()
        line = 1 - line
      },
      point(x: number, y: number) {
        if (count === 0) {
          if (line) context.lineTo(x, y)
          else context.moveTo(x, y)
        } else if (count > 1) {
          // The corner at the day before: cut from both sides, then curved.
          const cut = roundness / 2
          context.lineTo(x1 + (x0 - x1) * cut, y1 + (y0 - y1) * cut)
          context.quadraticCurveTo(
            x1,
            y1,
            x1 + (x - x1) * cut,
            y1 + (y - y1) * cut
          )
        }
        x0 = x1
        y0 = y1
        x1 = x
        y1 = y
        count += 1
      },
    }
  }
}

const CURVE = roundedCorners(ROUNDNESS)

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
          // The fill follows the same curve.
          type={CURVE}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
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
