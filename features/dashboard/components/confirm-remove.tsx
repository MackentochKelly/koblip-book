"use client"

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
import { useOwnerMessages } from "../i18n/provider"

// Asks before anything is removed for good (shadcn's Alert Dialog, as for
// cancelling a booking): open while `name` is set. Remove closes it and
// runs `onConfirm`; the result shows as a toast.
export function ConfirmRemove({
  name,
  onConfirm,
  onClose,
}: {
  name: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const c = useOwnerMessages().catalog.common
  return (
    <AlertDialog
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {name && c.confirmRemove.title(name)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {c.confirmRemove.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{c.confirmRemove.keep}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {c.remove}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
