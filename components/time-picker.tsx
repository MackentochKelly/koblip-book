"use client"

import { useState } from "react"

import { DayStrip } from "@/components/day-strip"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
// day's free times folded into morning, afternoon and evening (shadcn's
// Accordion), one open at a time, so a long day stays short. Used by the
// booking page's time step, rescheduling and the assistant's "When?".
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
    key: part.key,
    label: labels[part.key],
    times: times.filter((value) => {
      const hour = Number(value.slice(0, 2))
      return (
        hour < part.until && (index === 0 || hour >= DAY_PARTS[index - 1].until)
      )
    }),
  })).filter((group) => group.times.length > 0)

  // Until the person opens or closes a part on this day, the part with the
  // picked time is open, else the soonest one with free times. Worked out
  // on each render, so it stays right when the times arrive after the day.
  const [opened, setOpened] = useState<{
    date: string
    parts: string[]
  } | null>(null)
  const smart =
    groups.find((group) => time && group.times.includes(time)) ?? groups[0]
  const open = opened?.date === date ? opened.parts : smart ? [smart.key] : []

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
      <Accordion
        value={open}
        onValueChange={(parts) => setOpened({ date, parts })}
      >
        {groups.map((group) => (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger>
              <span className="flex-1">{group.label}</span>
              <span className="font-normal whitespace-nowrap text-muted-foreground tabular-nums">
                {formatClock(group.times[0], locale)} –{" "}
                {formatClock(group.times[group.times.length - 1], locale)}
              </span>
            </AccordionTrigger>
            <AccordionContent>
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
