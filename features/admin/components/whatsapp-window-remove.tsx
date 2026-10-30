"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Trash2Icon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { removeWindowEntry, type WindowEntryKey } from "../api/whatsapp-window-actions"
import { useAdminMessages } from "../i18n/provider"

// Removes one 24-hour window entry, after asking.
export function WhatsappWindowRemove({
  entry,
  phone,
}: {
  entry: WindowEntryKey
  phone: string
}) {
  const t = useAdminMessages().whatsapp.window
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const remove = () =>
    startTransition(async () => {
      const result = await removeWindowEntry(entry).catch(() => null)
      if (result?.ok) {
        toast.success(t.removed)
      } else {
        toast.error(t.failed)
      }
    })

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.remove(phone)}
        disabled={pending}
        onClick={() => setAsking(true)}
      >
        {pending ? <Spinner /> : <Trash2Icon />}
      </Button>
      <ConfirmDialog
        open={asking}
        title={t.removeTitle(phone)}
        description={t.removeText}
        confirm={t.removeConfirm}
        cancel={t.cancel}
        onConfirm={remove}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
