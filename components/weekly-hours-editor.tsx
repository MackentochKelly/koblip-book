"use client"

import { useId } from "react"
import { PlusIcon, XIcon } from "@/components/ui/icons"
import { TimeInput } from "@/components/time-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { formatWeekday } from "@/lib/format-booking-time"
import { DEFAULT_HOURS, HOURS_WEEK, type HoursRow } from "@/lib/hours-rules"
import { BOOKING_RULES } from "@/lib/booking-rules"

interface HoursLabels {
  closed: string
  opens: (day: string) => string
  closes: (day: string) => string
  remove: string
  add: string
}
export function WeeklyHoursEditor({
  rows,
  onChange,
  locale,
  labels: t,
}: {
  rows: HoursRow[]
  onChange: (rows: HoursRow[]) => void
  locale: string
  labels: HoursLabels
}) {
  const id = useId()
  const days = Object.fromEntries(
    HOURS_WEEK.map((day) => [day, rows.filter((row) => row.weekday === day)])
  )
  const total = rows.length
  const update = (
    weekday: number,
    ranges: Array<{ opensAt: string; closesAt: string }>
  ) =>
    onChange(
      HOURS_WEEK.flatMap((day) =>
        day === weekday
          ? ranges.map((range) => ({ weekday, ...range }))
          : days[day]
      )
    )
  return (
    <FieldGroup>
      {HOURS_WEEK.map((weekday) => {
        // Spanish weekdays come lowercase; a label starts with a capital.
        const name = formatWeekday(weekday, locale)
        const label = name.charAt(0).toUpperCase() + name.slice(1)
        const ranges = days[weekday]
        const open = ranges.length > 0
        const setTime = (
          rangeIndex: number,
          key: "opensAt" | "closesAt",
          value: string
        ) =>
          update(
            weekday,
            ranges.map((item, i) =>
              i === rangeIndex ? { ...item, [key]: value } : item
            )
          )
        return (
          <div key={weekday} className="flex flex-col gap-3">
            {/* The whole day row is the switch's tap area. */}
            <FieldLabel className="min-h-11" htmlFor={`${id}-day-${weekday}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{label}</FieldTitle>
                  {!open && <FieldDescription>{t.closed}</FieldDescription>}
                </FieldContent>
                <Switch
                  id={`${id}-day-${weekday}`}
                  checked={open}
                  disabled={!open && total >= BOOKING_RULES.maxHoursRows}
                  onCheckedChange={(on) =>
                    update(weekday, on ? [{ ...DEFAULT_HOURS }] : [])
                  }
                />
              </Field>
            </FieldLabel>
            {ranges.map((range, rangeIndex) => (
              <Field key={rangeIndex} orientation="horizontal">
                <TimeInput
                  className="min-h-11 md:min-h-9"
                  aria-label={t.opens(label)}
                  value={range.opensAt}
                  onChange={(event) =>
                    setTime(rangeIndex, "opensAt", event.target.value)
                  }
                />
                <span className="text-muted-foreground">–</span>
                <TimeInput
                  className="min-h-11 md:min-h-9"
                  aria-label={t.closes(label)}
                  value={range.closesAt}
                  onChange={(event) =>
                    setTime(rangeIndex, "closesAt", event.target.value)
                  }
                />
                {rangeIndex > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                    aria-label={t.remove}
                    onClick={() =>
                      update(
                        weekday,
                        ranges.filter((_, i) => i !== rangeIndex)
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                )}
              </Field>
            ))}
            {open && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 min-w-11 self-start md:min-h-8"
                disabled={total >= BOOKING_RULES.maxHoursRows}
                onClick={() =>
                  update(weekday, [...ranges, { opensAt: "", closesAt: "" }])
                }
              >
                <PlusIcon data-icon="inline-start" />
                {t.add}
              </Button>
            )}
          </div>
        )
      })}
    </FieldGroup>
  )
}
