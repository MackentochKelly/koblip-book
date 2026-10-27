import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { formatClock, formatWeekday } from "@/lib/format-booking-time"
import { messagesFor, type Messages } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"
import type { DayHours } from "../utils/group-hours"

function dayTime(day: DayHours, m: Messages): string {
  if (day.ranges.length === 0) return m.hours.closed
  if (
    day.ranges.some(
      (range) => range.opensAt === "00:00" && range.closesAt === "00:00"
    )
  ) {
    return m.hours.open24
  }
  return day.ranges
    .map(
      (range) =>
        `${formatClock(range.opensAt, m.locale)} – ${formatClock(range.closesAt, m.locale)}`
    )
    .join(", ")
}

// The week's hours, today picked out.
export function OpeningHours({
  days,
  todayWeekday,
  language,
}: {
  days: DayHours[]
  todayWeekday: number
  language: PageLanguage
}) {
  const m = messagesFor(language)
  return (
    <PageSection id="hours" title={m.sections.hours}>
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
                {formatWeekday(day.weekday, m.locale)}
                {isToday && <Badge variant="outline">{m.hours.today}</Badge>}
              </dt>
              <dd className="text-right tabular-nums">{dayTime(day, m)}</dd>
            </div>
          )
        })}
      </dl>
    </PageSection>
  )
}
