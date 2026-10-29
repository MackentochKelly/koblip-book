"use client"

import { useState } from "react"
import { InfoCircleIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// A row's ⓘ, as Apple's detail button: it opens what the row is about in a
// dialog in the middle of the screen, `media` (a logo) above `title` and
// the whole `text`. The row itself keeps a short text and its own action.
export function DetailsButton({
  title,
  text,
  media,
  label,
}: {
  title: string
  text: string
  media?: React.ReactNode
  // Its name for screen readers, e.g. "About WhatsApp".
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        // Beside a line of text without making it taller or wider: only
        // the icon takes room, the tap area stays.
        className="-m-2 text-muted-foreground"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <InfoCircleIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="items-center gap-3 text-center">
            {media}
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-pretty">{text}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
