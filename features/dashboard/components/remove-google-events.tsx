"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { useOwnerMessages } from "../i18n/provider"

// The choice when disconnecting a Google Calendar (G10): keep the bookings'
// events in Google, or remove them with the "Koblip Book" calendar. Off to
// start, so nothing is removed unless asked.
export function RemoveGoogleEvents({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const t = useOwnerMessages().integrations.googleCalendar
  return (
    <Field orientation="horizontal">
      <Checkbox
        id="remove-google-events"
        checked={checked}
        onCheckedChange={(on) => onCheckedChange(on === true)}
      />
      <FieldLabel htmlFor="remove-google-events" className="font-normal">
        {t.removeEvents}
      </FieldLabel>
    </Field>
  )
}
