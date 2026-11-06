"use client"

import { useTranslations } from "next-intl"

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

// Asks before anything is removed for good (shadcn's Alert Dialog, as for
// cancelling a booking): open while `name` is set. Remove closes it and
// runs `onConfirm`; the result shows as a toast. `children` is an extra
// choice about how to remove it, under the description.
export function ConfirmRemove({
  name,
  description,
  onConfirm,
  onClose,
  children,
}: {
  name: string | null
  // The line under the title, for what removing it does instead (a
  // category's services move to Other). Left out: it can't be undone.
  description?: string
  onConfirm: () => void
  onClose: () => void
  children?: React.ReactNode
}) {
  const t = useTranslations("owner.catalog.common")
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
            {name && t("confirmRemove.title", { name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("confirmRemove.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("confirmRemove.keep")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {t("remove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
