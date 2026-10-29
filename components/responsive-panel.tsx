"use client"

import { BottomPanel } from "@/components/bottom-panel"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

// One panel for a form or a choice: the phone's bottom sheet, a dialog on a
// computer. Keep it mounted and toggle `open` so it animates. `media` (a
// logo or a photo) sits centred above the title.
export function ResponsivePanel({
  open,
  onClose,
  title,
  media,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  media?: React.ReactNode
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
          media && (
            <DrawerHeader className="items-center gap-3 text-center">
              {media}
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
        <DialogHeader className={cn(media && "items-center gap-3 text-center")}>
          {media}
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
