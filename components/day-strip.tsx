"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { dayPickerLocale } from "@/lib/day-picker-locale"
import {
  addDaysTo,
  dateFromDay,
  dayFromDate,
  dayOfMonth,
  formatDay,
  formatWeekdayShort,
} from "@/lib/format-booking-time"

// A row of days to tap ("Today 31", "Tomorrow 1", "Mon 2" …) that scrolls
// sideways, with a calendar button at the end for any other day. Used by
// the booking page's time step and the owner's calendar on a phone.
export function DayStrip({
  days,
  value,
  onChange,
  today,
  locale,
  labels,
  isDisabled,
  note,
  startMonth,
  endMonth,
}: {
  days: string[] // "YYYY-MM-DD", in order
  value: string
  onChange: (day: string) => void
  today: string
  locale: string
  labels: { today: string; tomorrow: string; day: string; moreDates: string }
  // A day that cannot be picked (greyed in the row and the calendar).
  isDisabled?: (day: string) => boolean
  // A small line under the day's number, like how many bookings it has.
  note?: (day: string) => React.ReactNode
  // How far the calendar goes; open-ended when left out.
  startMonth?: string
  endMonth?: string
}) {
  const [monthOpen, setMonthOpen] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const tomorrow = addDaysTo(today, 1)

  // The picked day slides to the middle of the row, also when it was
  // picked in the calendar or the row's days change; only the row
  // scrolls, never the page.
  const firstDay = days[0]
  useEffect(() => {
    const strip = row.current
    const chip = strip?.querySelector<HTMLElement>(`[data-day="${value}"]`)
    if (!strip || !chip) return
    strip.scrollTo({
      left: chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2,
      behavior: "smooth",
    })
  }, [value, firstDay])

  return (
    <div className="flex items-stretch gap-2">
      <div
        ref={row}
        className="no-scrollbar relative min-w-0 flex-1 scroll-fade-x overflow-x-auto"
      >
        <ToggleGroup
          variant="outline"
          aria-label={labels.day}
          value={[value]}
          onValueChange={(next) => {
            if (next[0]) onChange(next[0])
          }}
        >
          {days.map((day) => (
            <ToggleGroupItem
              key={day}
              value={day}
              data-day={day}
              aria-label={formatDay(day, locale)}
              disabled={isDisabled?.(day)}
              className="h-auto min-w-16 flex-col gap-0 py-2"
            >
              <span className="text-xs font-normal">
                {day === today
                  ? labels.today
                  : day === tomorrow
                    ? labels.tomorrow
                    : formatWeekdayShort(day, locale)}
              </span>
              <span className="text-base font-semibold">{dayOfMonth(day)}</span>
              {note && (
                <span className="text-xs font-normal text-muted-foreground">
                  {note(day)}
                </span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Popover open={monthOpen} onOpenChange={setMonthOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              aria-label={labels.moreDates}
              className="h-auto self-stretch"
            />
          }
        >
          <CalendarIcon />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <Calendar
            mode="single"
            required
            locale={dayPickerLocale(locale)}
            selected={dateFromDay(value)}
            onSelect={(date) => {
              onChange(dayFromDate(date))
              setMonthOpen(false)
            }}
            defaultMonth={dateFromDay(value)}
            startMonth={startMonth ? dateFromDay(startMonth) : undefined}
            endMonth={endMonth ? dateFromDay(endMonth) : undefined}
            disabled={
              isDisabled ? (date) => isDisabled(dayFromDate(date)) : undefined
            }
            showOutsideDays={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
