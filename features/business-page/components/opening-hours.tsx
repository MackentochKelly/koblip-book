import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DayHours } from "../utils/group-hours"

// "20:30" → "8:30 PM", as Google words it.
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(Date.UTC(2000, 0, 1, hours, minutes))
}

function dayTime(day: DayHours): string {
  if (day.ranges.length === 0) return "Closed"
  if (
    day.ranges.some(
      (range) => range.opensAt === "00:00" && range.closesAt === "00:00"
    )
  ) {
    return "Open 24 hours"
  }
  return day.ranges
    .map(
      (range) => `${formatTime(range.opensAt)} – ${formatTime(range.closesAt)}`
    )
    .join(", ")
}

// The week's hours, today picked out.
export function OpeningHours({
  days,
  todayWeekday,
}: {
  days: DayHours[]
  todayWeekday: number
}) {
  return (
    <PageSection id="hours" title="Opening times">
      <dl className="flex flex-col gap-2.5 text-sm">
        {days.map((day) => {
          const isToday = day.weekday === todayWeekday
          return (
            <div
              key={day.weekday}
              className={cn(
                "flex items-baseline justify-between gap-4",
                isToday
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <dt className="flex items-center gap-2">
                {day.label}
                {isToday && <Badge variant="outline">Today</Badge>}
              </dt>
              <dd className="text-right tabular-nums">{dayTime(day)}</dd>
            </div>
          )
        })}
      </dl>
    </PageSection>
  )
}
