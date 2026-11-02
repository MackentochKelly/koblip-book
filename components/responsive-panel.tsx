"use client"

import { BottomPanel } from "@/components/bottom-panel"
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
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
// computer. Keep it mounted and toggle `open` so it animates. `icon`: a
// picture above the title, both centred.
export function ResponsivePanel({
  open,
  onClose,
  title,
  icon,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const phone = useIsMobile()
  if (phone) {
    return (
      <BottomPanel
        open={open}
        onClose={onClose}
        title={title}
        header={
          icon && (
            <DrawerHeader className="items-center text-center">
              {icon}
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
          )
        }
        footer={footer}
      >
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
        <DialogHeader className={cn(icon && "items-center text-center")}>
          {icon}
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 max-h-[60dvh] scroll-fade overflow-y-auto px-6 py-2">
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
