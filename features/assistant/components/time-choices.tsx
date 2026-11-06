"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { TimePicker } from "@/components/time-picker"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import type { ChatTimes } from "../utils/chat-state"

// The booking page's day and time picker under the assistant's "When?":
// a tap on a time sends it as the reply, in words.
export function TimeChoices({
  times,
  onPick,
}: {
  times: ChatTimes
  onPick: (text: string) => void
}) {
  const t = useTranslations("assistant.times")
  const locale = useLocale()
  const first = times.days.find((day) => day.times.length > 0)
  const [date, setDate] = useState(first?.date ?? "")
  if (!first) return null

  const pick = (time: string) => {
    const when = {
      service: times.service,
      day: formatDay(date, locale),
      time: formatClock(time, locale),
    }
    return times.teamMember
      ? t("pickWith", { ...when, member: times.teamMember })
      : t("pick", when)
  }

  return (
    <TimePicker
      days={times.days}
      date={date}
      onDateChange={setDate}
      time={null}
      onTimeChange={(time) => onPick(pick(time))}
      today={times.today}
      locale={locale}
      labels={{
        today: t("today"),
        tomorrow: t("tomorrow"),
        day: t("day"),
        moreDates: t("moreDates"),
        morning: t("morning"),
        afternoon: t("afternoon"),
        evening: t("evening"),
        timesOf: (part) => t("timesOf", { part }),
      }}
    />
  )
}
