"use client"

import { useState } from "react"

import { TimePicker } from "@/components/time-picker"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import type { AssistantMessages } from "../i18n"
import type { ChatTimes } from "../utils/chat-state"

// The booking page's day and time picker under the assistant's "When?":
// a tap on a time sends it as the reply, in words.
export function TimeChoices({
  times,
  onPick,
  locale,
  labels,
}: {
  times: ChatTimes
  onPick: (text: string) => void
  locale: string
  labels: AssistantMessages["times"]
}) {
  const first = times.days.find((day) => day.times.length > 0)
  const [date, setDate] = useState(first?.date ?? "")
  if (!first) return null

  return (
    <TimePicker
      days={times.days}
      date={date}
      onDateChange={setDate}
      time={null}
      onTimeChange={(time) =>
        onPick(
          labels.pick(
            times.service,
            times.teamMember,
            formatDay(date, locale),
            formatClock(time, locale)
          )
        )
      }
      today={times.today}
      locale={locale}
      labels={labels}
    />
  )
}
