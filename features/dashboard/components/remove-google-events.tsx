"use client"

import { useTranslations } from "next-intl"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

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
  const t = useTranslations("owner.integrations.googleCalendar")
  return (
    <Field orientation="horizontal">
      <Checkbox
        id="remove-google-events"
        checked={checked}
        onCheckedChange={(on) => onCheckedChange(on === true)}
      />
      <FieldLabel htmlFor="remove-google-events" className="font-normal">
        {t("removeEvents")}
      </FieldLabel>
    </Field>
  )
}
