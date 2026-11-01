"use client"

import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item"
import { formatClock, formatWeekday } from "@/lib/format-booking-time"
import { HOURS_WEEK, type HoursRow } from "@/lib/hours-rules"
import { useTeamAreaWords } from "../i18n/provider"

// The team member's working week, Monday first; the owner changes it.
export function MyHours({ rows }: { rows: HoursRow[] }) {
  const t = useTeamAreaWords()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.hours.note}</p>
      <ItemGroup className="gap-3">
        {HOURS_WEEK.map((weekday) => {
          const open = rows.filter((row) => row.weekday === weekday)
          return (
            <Item key={weekday} variant="outline">
              <ItemContent>
                <ItemTitle>{formatWeekday(weekday, t.locale)}</ItemTitle>
              </ItemContent>
              <div className="flex flex-col items-end text-sm text-muted-foreground">
                {open.length === 0 ? (
                  <span>{t.hours.closed}</span>
                ) : (
                  open.map((row) => (
                    <span key={row.opensAt}>
                      {formatClock(row.opensAt, t.locale)} – {formatClock(row.closesAt, t.locale)}
                    </span>
                  ))
                )}
              </div>
            </Item>
          )
        })}
      </ItemGroup>
    </div>
  )
}
