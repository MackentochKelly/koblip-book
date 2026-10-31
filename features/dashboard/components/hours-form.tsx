"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { WeeklyHoursEditor } from "@/components/weekly-hours-editor"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { validHours } from "@/lib/hours-rules"
import { useOwnerMessages } from "../i18n/provider"
import { saveHours } from "../api/actions"
import type { HoursRow } from "../types"

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
  const [rows, setRows] = useState(hours)
  const save = () =>
    startTransition(async () => {
      if (!validHours(rows)) {
        toast.error(t.fillEvery)
        return
      }
      const result = await saveHours(businessId, rows).catch(() => null)
      if (result?.ok) {
        toast.success(t.saved)
        router.refresh()
      } else toast.error(result ? t.saveFailed : m.settings.tryAgain)
    })
  return (
    <div className="flex flex-col gap-6">
      <WeeklyHoursEditor
        rows={rows}
        onChange={setRows}
        locale={m.locale}
        labels={t}
      />
      {/* Save waits for a change. */}
      <Button
        size="lg"
        onClick={save}
        disabled={pending || JSON.stringify(rows) === JSON.stringify(hours)}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {m.settings.save}
      </Button>
    </div>
  )
}
