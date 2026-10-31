"use client"

import { useState } from "react"

import { BottomPanel } from "@/components/bottom-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { FilterIcon } from "@/components/ui/icons"

// A phone list's filters: one "Filters 2" button that opens a bottom sheet
// with every filter. A change shows at once; Clear all and the button that
// shows the results sit at the foot.
export function FilterSheet({
  label,
  count,
  clearLabel,
  onClear,
  doneLabel,
  children,
}: {
  label: string
  // How many filters are on, shown on the button.
  count: number
  clearLabel: string
  onClear: () => void
  // Like "Show 5 bookings"; it closes the sheet.
  doneLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FilterIcon data-icon="inline-start" />
        {label}
        {count > 0 && <Badge variant="secondary">{count}</Badge>}
      </Button>
      <BottomPanel
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onClear} disabled={count === 0}>
              {clearLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{doneLabel}</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">{children}</div>
      </BottomPanel>
    </>
  )
}

// One filter in the sheet: a heading and a box to tick for each option.
// None ticked shows everything.
export function FilterChecks({
  id,
  legend,
  options,
  value,
  onChange,
}: {
  id: string
  legend: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <FieldGroup data-slot="checkbox-group" className="gap-0">
        {options.map((option) => (
          <Field key={option.value} orientation="horizontal" className="min-h-11">
            <Checkbox
              id={`${id}-${option.value}`}
              checked={value.includes(option.value)}
              onCheckedChange={(on) =>
                onChange(
                  options
                    .map((item) => item.value)
                    .filter((item) =>
                      item === option.value ? on : value.includes(item)
                    )
                )
              }
            />
            <FieldLabel htmlFor={`${id}-${option.value}`} className="flex-1">
              {option.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  )
}
