"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { ChevronDownIcon } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { dayPickerLocale } from "@/lib/day-picker-locale"
import {
  dateFromDay,
  dayFromDate,
  formatDayShort,
} from "@/lib/format-booking-time"
import { CONTROL_SIZE } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// The app's own day picker (shadcn's Date Picker: a button that opens the
// month calendar), in place of the browser's date box. Days are
// "YYYY-MM-DD"; `min`/`max` limit what can be picked. With a `placeholder`
// the day is optional: "" shows the placeholder, and picking the chosen
// day again clears it.
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  locale = "en-US",
  invalid,
  placeholder,
}: {
  id?: string
  value: string
  onChange: (day: string) => void
  min?: string
  max?: string
  locale?: string
  invalid?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const picked = value === "" ? undefined : dateFromDay(value)
  const limits = {
    locale: dayPickerLocale(locale),
    defaultMonth: picked ?? (min ? dateFromDay(min) : undefined),
    startMonth: min ? dateFromDay(min) : undefined,
    endMonth: max ? dateFromDay(max) : undefined,
    disabled: (day: Date) => {
      const shown = dayFromDate(day)
      return (
        (min !== undefined && shown < min) || (max !== undefined && shown > max)
      )
    },
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            aria-invalid={invalid || undefined}
            // A field in a form: a field's height (lib/control-size).
            className={cn(
              "w-full justify-between font-normal",
              CONTROL_SIZE.field
            )}
          />
        }
      >
        {picked ? (
          formatDayShort(value, locale)
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        {placeholder === undefined ? (
          <Calendar
            mode="single"
            required
            {...limits}
            selected={picked}
            onSelect={(day) => {
              onChange(dayFromDate(day))
              setOpen(false)
            }}
          />
        ) : (
          <Calendar
            mode="single"
            {...limits}
            selected={picked}
            onSelect={(day) => {
              onChange(day ? dayFromDate(day) : "")
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
