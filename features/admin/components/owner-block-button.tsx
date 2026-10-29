"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { setOwnerBlocked } from "../api/actions"
import { useAdminMessages } from "../i18n/provider"

// Block asks first (shadcn's Alert Dialog); Unblock acts at once.
export function OwnerBlockButton({
  userId,
  name,
  blocked,
}: {
  userId: string
  name: string
  blocked: boolean
}) {
  const t = useAdminMessages().owners
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const save = (block: boolean) =>
    startTransition(async () => {
      const result = await setOwnerBlocked(userId, block).catch(() => null)
      if (result?.ok) {
        toast.success(block ? t.blockedToast : t.unblockedToast)
      } else {
        toast.error(t.failed)
      }
    })

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => (blocked ? save(false) : setAsking(true))}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {blocked ? t.unblock : t.block}
      </Button>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.blockTitle(name)}</AlertDialogTitle>
            <AlertDialogDescription>{t.blockText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setAsking(false)
                save(true)
              }}
            >
              {t.block}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
