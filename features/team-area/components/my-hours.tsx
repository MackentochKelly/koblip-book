"use client"

import { useLocale, useTranslations } from "next-intl"

import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item"
import { formatClock, formatWeekday } from "@/lib/format-booking-time"
import { HOURS_WEEK, type HoursRow } from "@/lib/hours-rules"

// The team member's working week, Monday first; the owner changes it.
export function MyHours({ rows }: { rows: HoursRow[] }) {
  const t = useTranslations("teamArea.hours")
  const locale = useLocale()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("note")}</p>
      <ItemGroup className="gap-3">
        {HOURS_WEEK.map((weekday) => {
          const open = rows.filter((row) => row.weekday === weekday)
          return (
            <Item key={weekday} variant="outline">
              <ItemContent>
                <ItemTitle>{formatWeekday(weekday, locale)}</ItemTitle>
              </ItemContent>
              <div className="flex flex-col items-end text-sm text-muted-foreground">
                {open.length === 0 ? (
                  <span>{t("closed")}</span>
                ) : (
                  open.map((row) => (
                    <span key={row.opensAt}>
                      {formatClock(row.opensAt, locale)} – {formatClock(row.closesAt, locale)}
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
