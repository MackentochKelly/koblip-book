"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, XIcon } from "lucide-react"
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
import { saveHours } from "../api/actions"
import type { HoursRow } from "../types"

// Monday first, as people read a week; stored with 0 = Sunday.
const WEEK = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
]
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
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [days, setDays] = useState<Record<number, Range[]>>(() => {
    const byDay: Record<number, Range[]> = {}
    for (const { weekday } of WEEK) byDay[weekday] = []
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
      const rows = WEEK.flatMap(({ weekday }) =>
        days[weekday].map((range) => ({ weekday, ...range }))
      )
      if (rows.some((row) => !row.opensAt || !row.closesAt)) {
        toast.error("Fill in every time.")
        return
      }
      const result = await saveHours(businessId, rows)
      if (result.ok) {
        toast.success("Hours saved")
        router.refresh()
      } else {
        toast.error("Could not save. Check the times.")
      }
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Hours</h1>
        <Button onClick={save} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </div>
      <FieldGroup>
        {WEEK.map(({ weekday, label }, index) => {
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
                  {!open && <FieldDescription>Closed</FieldDescription>}
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
                    aria-label={`${label} opens`}
                    value={range.opensAt}
                    onChange={(event) =>
                      setTime(rangeIndex, "opensAt", event.target.value)
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    aria-label={`${label} closes`}
                    value={range.closesAt}
                    onChange={(event) =>
                      setTime(rangeIndex, "closesAt", event.target.value)
                    }
                  />
                  {rangeIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove these hours"
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
                  Add hours
                </Button>
              )}
            </div>
          )
        })}
      </FieldGroup>
    </div>
  )
}
