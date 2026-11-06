"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { removeFreePro } from "../api/subscription-actions"

// Remove on a free Pro row (P7b): asks first, then ends the subscription now.
export function RemoveFreePro({ grantId, name }: { grantId: number; name: string }) {
  const t = useTranslations("admin.subscriptions.remove")
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const remove = () =>
    startTransition(async () => {
      const done = await removeFreePro(grantId).catch(() => null)
      if (done?.ok) {
        toast.success(t("removed"))
        router.refresh()
      } else {
        toast.error(t("failed"))
      }
    })

  return (
    <>
      <Button variant="outline" disabled={pending} onClick={() => setAsking(true)}>
        {pending && <Spinner data-icon="inline-start" />}
        {t("label")}
      </Button>
      <ConfirmDialog
        open={asking}
        title={t("title", { name })}
        description={t("text")}
        confirm={t("confirm")}
        cancel={t("cancel")}
        onConfirm={remove}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
