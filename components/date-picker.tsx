"use client"

import { useState } from "react"
import { es } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { ChevronDownIcon } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  dateFromDay,
  dayFromDate,
  formatDayShort,
} from "@/lib/format-booking-time"

// The app's own day picker (shadcn's Date Picker: a button that opens the
// month calendar), in place of the browser's date box. Days are
// "YYYY-MM-DD"; `min`/`max` limit what can be picked.
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  locale = "en-US",
  invalid,
}: {
  id?: string
  value: string
  onChange: (day: string) => void
  min?: string
  max?: string
  locale?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            aria-invalid={invalid || undefined}
            className="w-full justify-between font-normal"
          />
        }
      >
        {formatDayShort(value, locale)}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          required
          locale={locale.startsWith("es") ? es : undefined}
          selected={dateFromDay(value)}
          defaultMonth={dateFromDay(value)}
          startMonth={min ? dateFromDay(min) : undefined}
          endMonth={max ? dateFromDay(max) : undefined}
          disabled={(day) => {
            const picked = dayFromDate(day)
            return (
              (min !== undefined && picked < min) ||
              (max !== undefined && picked > max)
            )
          }}
          onSelect={(day) => {
            onChange(dayFromDate(day))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
