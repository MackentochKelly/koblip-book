"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { FormActions } from "@/components/form-actions"
import { WeeklyHoursEditor } from "@/components/weekly-hours-editor"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { validHours } from "@/lib/hours-rules"
import { saveHours } from "../api/actions"
import type { HoursRow } from "../types"

export function HoursForm({
  businessId,
  hours,
}: {
  businessId: string
  hours: HoursRow[]
}) {
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.hours")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState(hours)
  const save = () =>
    startTransition(async () => {
      if (!validHours(rows)) {
        toast.error(t("fillEvery"))
        return
      }
      const result = await saveHours(businessId, rows).catch(() => null)
      if (result?.ok) {
        toast.success(t("saved"))
        router.refresh()
      } else toast.error(result ? t("saveFailed") : settings("tryAgain"))
    })
  return (
    <div className="flex flex-col gap-6">
      <WeeklyHoursEditor
        rows={rows}
        onChange={setRows}
        locale={locale}
        labels={{
          closed: t("closed"),
          opens: (day) => t("opens", { day }),
          closes: (day) => t("closes", { day }),
          remove: t("remove"),
          add: t("add"),
        }}
      />
      {/* Save waits for a change. */}
      <FormActions>
        <Button
          size="lg"
          onClick={save}
          disabled={pending || JSON.stringify(rows) === JSON.stringify(hours)}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {settings("save")}
        </Button>
      </FormActions>
    </div>
  )
}
