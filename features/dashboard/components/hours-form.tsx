"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, XIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { formatWeekday } from "@/lib/format-booking-time"
import { saveHours } from "../api/actions"
import type { HoursRow } from "../types"

// Monday first, as people read a week; stored with 0 = Sunday.
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const MAX_ROWS = 14

interface Range {
  opensAt: string
  closesAt: string
}

// The opening hours bookings are taken in: each day open or closed, with
// one or more stretches (a lunch break is two).
export function HoursForm({
  businessId,
  hours,
}: {
  businessId: string
  hours: HoursRow[]
}) {
  const m = useOwnerMessages()
  const t = m.settings.hours
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [days, setDays] = useState<Record<number, Range[]>>(() => {
    const byDay: Record<number, Range[]> = {}
    for (const weekday of WEEK) byDay[weekday] = []
    for (const row of hours) {
      byDay[row.weekday].push({ opensAt: row.opensAt, closesAt: row.closesAt })
    }
    return byDay
  })
  const total = Object.values(days).reduce(
    (sum, ranges) => sum + ranges.length,
    0
  )
  const update = (weekday: number, ranges: Range[]) =>
    setDays((current) => ({ ...current, [weekday]: ranges }))

  const save = () =>
    startTransition(async () => {
      const rows = WEEK.flatMap((weekday) =>
        days[weekday].map((range) => ({ weekday, ...range }))
      )
      if (rows.some((row) => !row.opensAt || !row.closesAt)) {
        toast.error(t.fillEvery)
        return
      }
      const result = await saveHours(businessId, rows).catch(() => null)
      if (result?.ok) {
        toast.success(t.saved)
        router.refresh()
      } else {
        // No answer at all (offline, server down) is not the fields' fault.
        toast.error(result ? t.saveFailed : m.settings.tryAgain)
      }
    })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {m.shell.nav.hours}
      </h1>
      <FieldGroup>
        {WEEK.map((weekday, index) => {
          // Spanish weekdays come lowercase; a label starts with a capital.
          const name = formatWeekday(weekday, m.locale)
          const label = name.charAt(0).toUpperCase() + name.slice(1)
          const ranges = days[weekday]
          const open = ranges.length > 0
          const setTime = (
            rangeIndex: number,
            key: keyof Range,
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
              {index > 0 && <FieldSeparator />}
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={`day-${weekday}`}>{label}</FieldLabel>
                  {!open && <FieldDescription>{t.closed}</FieldDescription>}
                </FieldContent>
                <Switch
                  id={`day-${weekday}`}
                  checked={open}
                  disabled={!open && total >= MAX_ROWS}
                  onCheckedChange={(on) =>
                    update(
                      weekday,
                      on ? [{ opensAt: "09:00", closesAt: "17:00" }] : []
                    )
                  }
                />
              </Field>
              {ranges.map((range, rangeIndex) => (
                <Field key={rangeIndex} orientation="horizontal">
                  <Input
                    type="time"
                    aria-label={t.opens(label)}
                    value={range.opensAt}
                    onChange={(event) =>
                      setTime(rangeIndex, "opensAt", event.target.value)
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    aria-label={t.closes(label)}
                    value={range.closesAt}
                    onChange={(event) =>
                      setTime(rangeIndex, "closesAt", event.target.value)
                    }
                  />
                  {rangeIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
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
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  disabled={total >= MAX_ROWS}
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
      {/* Save is the big button at the end, like the Settings form's. */}
      <Button size="lg" onClick={save} disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        {m.settings.save}
      </Button>
    </div>
  )
}
