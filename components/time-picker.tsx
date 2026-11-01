"use client"

import { DayStrip } from "@/components/day-strip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatClock, formatDay } from "@/lib/format-booking-time"

// Parts of the day the free times are grouped under (until that hour).
const DAY_PARTS = [
  { key: "morning", until: 12 },
  { key: "afternoon", until: 17 },
  { key: "evening", until: 24 },
] as const

export interface FreeDay {
  date: string // "YYYY-MM-DD"
  times: string[] // "HH:mm", in order
}

// A sideways row of days with the month one tap away, then the picked
// day's free times grouped into morning, afternoon and evening. Used by
// the booking page's time step and the assistant's "When?".
export function TimePicker({
  days,
  date,
  onDateChange,
  time,
  onTimeChange,
  today,
  locale,
  labels,
}: {
  days: FreeDay[]
  date: string // the picked day; one with free times
  onDateChange: (date: string) => void
  time: string | null // the picked time on that day
  onTimeChange: (time: string) => void
  today: string
  locale: string
  labels: {
    today: string
    tomorrow: string
    day: string
    moreDates: string
    morning: string
    afternoon: string
    evening: string
    timesOf: (part: string) => string
  }
}) {
  const freeDays = new Set(
    days.filter((day) => day.times.length > 0).map((day) => day.date)
  )
  const times = days.find((day) => day.date === date)?.times ?? []
  const groups = DAY_PARTS.map((part, index) => ({
    label: labels[part.key],
    times: times.filter((value) => {
      const hour = Number(value.slice(0, 2))
      return (
        hour < part.until && (index === 0 || hour >= DAY_PARTS[index - 1].until)
      )
    }),
  })).filter((group) => group.times.length > 0)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <DayStrip
        days={days.map((day) => day.date)}
        value={date}
        onChange={(next) => {
          if (next !== date) onDateChange(next)
        }}
        today={today}
        locale={locale}
        labels={labels}
        isDisabled={(day) => !freeDays.has(day)}
        startMonth={days[0]?.date}
        endMonth={days[days.length - 1]?.date}
      />

      <p className="text-sm font-medium">{formatDay(date, locale)}</p>
      {groups.map((group) => (
        <section
          key={group.label}
          aria-label={group.label}
          className="flex flex-col gap-2"
        >
          <h3 className="text-sm text-muted-foreground">{group.label}</h3>
          <ToggleGroup
            variant="outline"
            aria-label={labels.timesOf(group.label)}
            value={time ? [time] : []}
            onValueChange={(value) => {
              if (value[0]) onTimeChange(value[0])
            }}
            className="grid w-full grid-cols-3 sm:grid-cols-4"
          >
            {group.times.map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                // The chosen time is filled with the main colour, like a
                // checked radio or switch, so the tap clearly took.
                className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {formatClock(value, locale)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      ))}
    </div>
  )
}
