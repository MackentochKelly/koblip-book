"use client"

import { BottomPanel } from "@/components/bottom-panel"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"

// One panel for a form or a choice: the phone's bottom sheet, a dialog on a
// computer. Keep it mounted and toggle `open` so it animates.
export function ResponsivePanel({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const phone = useIsMobile()
  if (phone) {
    return (
      <BottomPanel open={open} onClose={onClose} title={title} footer={footer}>
        {children}
      </BottomPanel>
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 max-h-[60dvh] overflow-y-auto px-6">
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
