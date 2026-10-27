import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DayHours } from "../utils/group-hours"

export function OpeningHours({
  days,
  todayWeekday,
}: {
  days: DayHours[]
  todayWeekday: number
}) {
  return (
    <PageSection title="Opening hours">
      <div className="flex flex-col">
        {days.map((day) => {
          const isToday = day.weekday === todayWeekday
          return (
            <div
              key={day.weekday}
              className={cn(
                "-mx-2 flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-sm",
                isToday && "bg-muted font-medium"
              )}
            >
              <span className="flex items-center gap-2">
                {day.label}
                {isToday && (
                  <Badge variant="secondary" className="text-xs">
                    Today
                  </Badge>
                )}
              </span>
              {day.ranges.length === 0 ? (
                <span className="text-muted-foreground">Closed</span>
              ) : (
                <span>
                  {day.ranges
                    .map((range) => `${range.opensAt}–${range.closesAt}`)
                    .join(", ")}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </PageSection>
  )
}
