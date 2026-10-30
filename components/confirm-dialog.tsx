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

// Asks before a change that is hard to undo (shadcn's Alert Dialog): open
// while `open` is true. Confirm closes it and runs `onConfirm`. Words come
// from the caller, in its language.
export function ConfirmDialog({
  open,
  title,
  description,
  confirm,
  cancel,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirm: string
  cancel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
