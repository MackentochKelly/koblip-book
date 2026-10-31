"use client"

import { useEffect, useEffectEvent, useState } from "react"

import { TimePicker } from "@/components/time-picker"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import type { OwnerFreeTimes } from "@/types/owner-booking"
import { useOwnerMessages } from "../i18n/provider"

// Loads the free times again whenever `key` changes (what they depend on);
// undefined while they load. `onLoaded` runs with each new answer.
export function useFreeTimes(
  key: string,
  load: () => Promise<OwnerFreeTimes>,
  onLoaded: (free: OwnerFreeTimes) => void
) {
  const [free, setFree] = useState<OwnerFreeTimes | undefined>(undefined)
  // The page hands down new copies of its actions when it refreshes;
  // reading them here keeps the times from loading again for that alone.
  const loadNow = useEffectEvent(load)
  const loaded = useEffectEvent(onLoaded)
  useEffect(() => {
    let current = true
    loadNow()
      .catch(() => null)
      .then((found) => {
        if (!current) return
        setFree(found)
        loaded(found)
      })
    return () => {
      current = false
      setFree(undefined)
    }
  }, [key])
  return free
}

// The first day with a free time, if any.
export function firstFreeDay(free: OwnerFreeTimes | undefined) {
  return free?.days.find((day) => day.times.length > 0)?.date ?? null
}

// When a booking is: the free times first, as on the booking page, and
// Other time for any day and time (`children`, the plain fields). With no
// free times to offer, only the plain fields show.
export function BookingWhen({
  free,
  anyTime,
  onAnyTimeChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  today,
  error,
  children,
}: {
  free: OwnerFreeTimes | undefined
  anyTime: boolean
  onAnyTimeChange: (anyTime: boolean) => void
  date: string
  onDateChange: (date: string) => void
  time: string
  onTimeChange: (time: string) => void
  today: string
  // The message to show when no time is picked yet; null = none.
  error: string | null
  children: React.ReactNode
}) {
  const m = useOwnerMessages()
  const t = m.bookings.form
  const first = firstFreeDay(free)

  if (free === undefined && !anyTime) {
    return (
      <Field>
        <FieldLabel>{t.when}</FieldLabel>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </Field>
    )
  }
  if (anyTime || !free || first === null) {
    return (
      <>
        {children}
        {first !== null && (
          <Button
            type="button"
            variant="link"
            className="w-fit px-0"
            onClick={() => {
              onAnyTimeChange(false)
              onTimeChange("")
              // Back on a day with free times.
              const isFree = free?.days.some(
                (day) => day.date === date && day.times.length > 0
              )
              if (!isFree) onDateChange(first)
            }}
          >
            {t.freeTimes}
          </Button>
        )}
      </>
    )
  }
  return (
    <FieldSet className="min-w-0" data-invalid={error !== null || undefined}>
      <FieldLegend variant="label">{t.when}</FieldLegend>
      <TimePicker
        days={free.days}
        date={date}
        onDateChange={(next) => {
          onDateChange(next)
          onTimeChange("")
        }}
        time={time || null}
        onTimeChange={onTimeChange}
        today={today}
        locale={m.locale}
        labels={t.picker}
      />
      {error !== null && <FieldError>{error}</FieldError>}
      <Button
        type="button"
        variant="link"
        className="w-fit px-0"
        onClick={() => onAnyTimeChange(true)}
      >
        {t.otherTime}
      </Button>
    </FieldSet>
  )
}
