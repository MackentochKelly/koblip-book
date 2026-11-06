"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Trash2Icon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { useAdminMessages } from "../i18n/provider"

// Delete on an Owners, Businesses or Service categories row: asks first,
// then runs the page's delete action (passed in by the page) and shows how
// it went.
export function AdminDeleteButton({
  name,
  description,
  onDelete,
}: {
  name: string
  description: string
  onDelete: () => Promise<{ ok: boolean }>
}) {
  const t = useAdminMessages().remove
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const remove = () =>
    startTransition(async () => {
      const result = await onDelete().catch(() => null)
      if (result?.ok) {
        toast.success(t.deleted)
        router.refresh()
      } else {
        toast.error(t.failed)
      }
    })

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.label(name)}
        title={t.label(name)}
        disabled={pending}
        onClick={() => setAsking(true)}
      >
        {pending ? <Spinner /> : <Trash2Icon />}
      </Button>
      <ConfirmDialog
        open={asking}
        title={t.title(name)}
        description={description}
        confirm={t.delete}
        cancel={t.cancel}
        onConfirm={remove}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
