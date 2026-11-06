"use client"

import { useState } from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, CheckIcon } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { dayPickerLocale } from "@/lib/day-picker-locale"
import {
  dateFromDay,
  dayFromDate,
  formatDayRange,
  formatDay,
} from "@/lib/format-booking-time"

export interface DayRangeValue {
  from: string // "YYYY-MM-DD"
  to: string
}

export interface RangeChoice {
  id: string
  label: string
  range: DayRangeValue
}

// A button showing a date range ("Oct 1 – Jan 29"); it opens quick picks
// and a calendar to pick any range (first tap the start, then the end).
export function DateRangePicker({
  value,
  onChange,
  choices,
  locale,
  label,
  className,
}: {
  value: DayRangeValue
  onChange: (range: DayRangeValue) => void
  choices: RangeChoice[]
  locale: string
  // The button's name for screen readers, like "Dates".
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // The range being picked in the calendar, before its end is tapped.
  const [draft, setDraft] = useState<DateRange | null>(null)
  const picked = choices.find(
    (choice) =>
      choice.range.from === value.from && choice.range.to === value.to
  )
  const pick = (range: DayRangeValue) => {
    onChange(range)
    setOpen(false)
  }
  const text =
    value.from === value.to
      ? formatDay(value.from, locale)
      : formatDayRange(value.from, value.to, locale)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setDraft(null)
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="outline" aria-label={`${label}: ${text}`} className={className} />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        <span className="truncate">{picked?.label ?? text}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex max-md:flex-col">
          <div className="flex flex-col gap-1 p-2 md:w-48">
            {choices.map((choice) => (
              <Button
                key={choice.id}
                variant="ghost"
                className="justify-between"
                onClick={() => pick(choice.range)}
              >
                <span className="truncate">{choice.label}</span>
                {choice === picked && <CheckIcon />}
              </Button>
            ))}
          </div>
          <Separator orientation="vertical" className="max-md:hidden" />
          <Separator className="md:hidden" />
          <Calendar
            mode="range"
            locale={dayPickerLocale(locale)}
            defaultMonth={dateFromDay(value.from)}
            selected={
              draft ?? {
                from: dateFromDay(value.from),
                to: dateFromDay(value.to),
              }
            }
            onSelect={(range, day) => {
              // A fresh tap starts a new range; the second one ends it.
              if (!draft) {
                setDraft({ from: day, to: undefined })
                return
              }
              if (range?.from && range.to) {
                pick({ from: dayFromDate(range.from), to: dayFromDate(range.to) })
              } else {
                setDraft(range ?? null)
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
