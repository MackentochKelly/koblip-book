import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { formatClock, formatWeekday } from "@/lib/format-booking-time"
import { cn } from "@/lib/utils"
import type { DayHours } from "../utils/group-hours"

// A day's hours: closed, open all day, or each opening, in the page's
// words and clock.
function dayTime(
  day: DayHours,
  words: { closed: string; open24: string },
  locale: string
): string {
  if (day.ranges.length === 0) return words.closed
  if (
    day.ranges.some(
      (range) => range.opensAt === "00:00" && range.closesAt === "00:00"
    )
  ) {
    return words.open24
  }
  return day.ranges
    .map(
      (range) =>
        `${formatClock(range.opensAt, locale)} – ${formatClock(range.closesAt, locale)}`
    )
    .join(", ")
}

// The week's hours, today picked out. The title is the business's
// opening times unless given (a team member's own hours).
export function OpeningHours({
  days,
  todayWeekday,
  title,
}: {
  days: DayHours[]
  todayWeekday: number
  title?: string
}) {
  const t = useTranslations("public")
  const locale = useLocale()
  const words = { closed: t("hours.closed"), open24: t("hours.open24") }
  return (
    <PageSection id="hours" title={title ?? t("sections.hours")}>
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
                {formatWeekday(day.weekday, locale)}
                {isToday && <Badge variant="outline">{t("hours.today")}</Badge>}
              </dt>
              <dd className="text-right tabular-nums">{dayTime(day, words, locale)}</dd>
            </div>
          )
        })}
      </dl>
    </PageSection>
  )
}
