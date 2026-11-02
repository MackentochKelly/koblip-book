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
import { cn } from "@/lib/utils"

// One panel for a form or a choice: the phone's bottom sheet, a dialog on a
// computer. Keep it mounted and toggle `open` so it animates. `wide`: a
// large dialog, for a long list.
export function ResponsivePanel({
  open,
  onClose,
  title,
  wide = false,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  wide?: boolean
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
      <DialogContent className={cn(wide && "sm:max-w-3xl")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 max-h-[60dvh] scroll-fade overflow-y-auto overscroll-contain px-6 py-2">
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
