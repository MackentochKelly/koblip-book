"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { setGoogleCalendarBusyMember } from "../api/google-calendar-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { GoogleCalendarConnection } from "../types/google-calendar"

// "Nobody" in the radio group, which needs a string.
const NOBODY = ""

// The business's Google Calendar, opened from Manage on Integrations: which
// account, whose bookings its busy times block (G3), and Disconnect.
export function GoogleCalendarPanel({
  open,
  onClose,
  businessId,
  connection,
  team,
  onDisconnect,
}: {
  open: boolean
  onClose: () => void
  businessId: string
  connection: GoogleCalendarConnection
  team: { id: string; name: string }[]
  onDisconnect: () => void
}) {
  const t = useOwnerMessages().integrations.googleCalendar
  const router = useRouter()
  const [busyMember, setBusyMember] = useState(connection.busyTeamMemberId ?? NOBODY)
  const [saving, startSaving] = useTransition()

  function choose(next: string) {
    const before = busyMember
    setBusyMember(next)
    startSaving(async () => {
      const result = await setGoogleCalendarBusyMember(businessId, next || null).catch(() => null)
      if (!result?.ok) {
        setBusyMember(before)
        toast.error(t.saveFailed)
        return
      }
      router.refresh()
    })
  }

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.name}
      footer={
        <Button variant="outline" onClick={onDisconnect}>
          {t.disconnect}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t.account(connection.googleEmail)}</p>
        {team.length ? (
          <FieldSet disabled={saving}>
            <FieldLegend variant="label">{t.busyTitle}</FieldLegend>
            <FieldDescription>{t.busyHint}</FieldDescription>
            <RadioGroup value={busyMember} onValueChange={(next) => choose(String(next))}>
              {team.map((member) => (
                <FieldLabel key={member.id} htmlFor={`busy-${member.id}`}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{member.name}</FieldTitle>
                    </FieldContent>
                    <RadioGroupItem value={member.id} id={`busy-${member.id}`} />
                  </Field>
                </FieldLabel>
              ))}
              <FieldLabel htmlFor="busy-nobody">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{t.busyNobody}</FieldTitle>
                    <FieldDescription>{t.busyNobodyHint}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={NOBODY} id="busy-nobody" />
                </Field>
              </FieldLabel>
            </RadioGroup>
          </FieldSet>
        ) : (
          <p className="text-sm">{t.busyWholeBusiness}</p>
        )}
      </div>
    </ResponsivePanel>
  )
}
