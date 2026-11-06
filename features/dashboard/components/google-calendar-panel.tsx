"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Spinner } from "@/components/ui/spinner"
import { useNow } from "@/hooks/use-now"
import { formatAgo } from "@/lib/format-ago"
import {
  getGoogleCalendarChoices,
  setGoogleBusyCalendars,
  setGoogleCalendarBusyMember,
  syncGoogleCalendarNowFor,
} from "../api/google-calendar-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { GoogleCalendarChoice, GoogleCalendarConnection } from "../types/google-calendar"

// "Nobody" in the radio group, which needs a string.
const NOBODY = ""

// The business's Google Calendar, opened from Manage on Integrations: which
// account, when it last synced and Sync now (G9), which of its calendars
// block bookings (G4), whose bookings its busy times block (G3), and
// Disconnect.
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
  const m = useOwnerMessages()
  const t = m.integrations.googleCalendar
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

  // This panel's own Sync now answer, until the page has the newer one.
  const [synced, setSynced] = useState<string | null>(null)
  const lastSyncAt =
    synced && (!connection.lastSyncAt || synced > connection.lastSyncAt) ? synced : connection.lastSyncAt
  const now = useNow()
  const [syncing, startSyncing] = useTransition()

  function syncNow() {
    startSyncing(async () => {
      const result = await syncGoogleCalendarNowFor(businessId).catch(() => null)
      if (result?.ok) setSynced(result.lastSyncAt)
      if (!result?.ok || result.failed) toast.error(t.syncNowFailed)
      // The Integrations row shows the same state.
      router.refresh()
    })
  }

  // The account's calendars, read from Google each time the panel opens.
  const [calendars, setCalendars] = useState<GoogleCalendarChoice[] | null | "loading">("loading")
  const [loads, setLoads] = useState(0)
  useEffect(() => {
    if (!open) return
    let current = true
    getGoogleCalendarChoices(businessId)
      .catch(() => null)
      .then((next) => {
        if (current) setCalendars(next)
      })
    return () => {
      current = false
      setCalendars("loading")
    }
  }, [open, businessId, loads])

  function tick(calendarId: string, on: boolean) {
    if (!Array.isArray(calendars)) return
    const before = calendars
    const next = calendars.map((calendar) =>
      calendar.id === calendarId ? { ...calendar, blocks: on } : calendar
    )
    setCalendars(next)
    startSaving(async () => {
      const ids = next.filter((calendar) => calendar.blocks).map((calendar) => calendar.id)
      const result = await setGoogleBusyCalendars(businessId, ids).catch(() => null)
      if (!result?.ok) {
        setCalendars(before)
        toast.error(t.saveFailed)
      }
    })
  }

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.name}
      footer={
        <Button variant="outline" size="lg" onClick={onDisconnect}>
          {t.disconnect}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t.account(connection.googleEmail)}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {!lastSyncAt ? t.notSynced : now !== null &&
                // Never "in 5 seconds" when the clock ticked before the sync.
                t.synced(formatAgo(lastSyncAt, Math.max(now, Date.parse(lastSyncAt)), m.locale))}
          </p>
          <Button variant="outline" onClick={syncNow} disabled={syncing}>
            {syncing && <Spinner data-icon="inline-start" />}
            {t.syncNow}
          </Button>
        </div>
        <FieldSet disabled={saving}>
          <FieldLegend variant="label">{t.calendarsTitle}</FieldLegend>
          {calendars === "loading" ? (
            <Spinner className="text-muted-foreground" />
          ) : calendars === null ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t.calendarsFailed}</p>
              <Button variant="outline" onClick={() => setLoads((count) => count + 1)}>
                {t.tryAgain}
              </Button>
            </div>
          ) : (
            calendars.map((calendar) => (
              <FieldLabel key={calendar.id} htmlFor={`calendar-${calendar.id}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{calendar.name}</FieldTitle>
                    {calendar.primary && <FieldDescription>{t.mainCalendar}</FieldDescription>}
                  </FieldContent>
                  <Checkbox
                    id={`calendar-${calendar.id}`}
                    checked={calendar.blocks}
                    onCheckedChange={(on) => tick(calendar.id, on === true)}
                  />
                </Field>
              </FieldLabel>
            ))
          )}
        </FieldSet>
        {team.length ? (
          <FieldSet disabled={saving}>
            <FieldLegend variant="label">{t.busyTitle}</FieldLegend>
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
