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
// from the caller, in its language. `tone` "default" is for a change that
// removes nothing (sending something for review); removals stay red.
export function ConfirmDialog({
  open,
  title,
  description,
  confirm,
  cancel,
  tone = "destructive",
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirm: string
  cancel: string
  tone?: "destructive" | "default"
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
            variant={tone}
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
