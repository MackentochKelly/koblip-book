"use client"

import { useLayoutEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// A text cut to its first lines, with "Read more" only when it was cut. It
// opens the whole text in a dialog in the middle of the screen (phone and
// computer alike), under `media` and `title`. `children` draws the short text
// with the ref, so a row keeps its own text style (e.g. ItemDescription,
// which shows two lines).
export function ReadMore({
  text,
  title,
  media,
  label,
  children,
}: {
  text: string
  title: string
  media?: React.ReactNode
  // "Read more", in the page's language.
  label: string
  children: (ref: React.RefObject<HTMLParagraphElement | null>) => React.ReactNode
}) {
  const ref = useRef<HTMLParagraphElement | null>(null)
  const [cut, setCut] = useState(false)
  const [open, setOpen] = useState(false)

  // Cut when the text needs more room than its lines give it; checked
  // again whenever its box changes size (rotation, a wider window).
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const check = () => setCut(node.scrollHeight > node.clientHeight + 1)
    const observer = new ResizeObserver(check)
    observer.observe(node)
    return () => observer.disconnect()
  }, [text])

  return (
    <>
      {/* Read more sits at the end of the last line, over a fade, as the
          App Store does: the text keeps its lines and the box its height. */}
      <div className="relative">
        {children(ref)}
        {cut && (
          <Button
            variant="link"
            size="sm"
            className="absolute end-0 bottom-0 h-auto rounded-none bg-linear-to-r from-transparent to-background to-25% p-0 ps-8 dark:text-foreground"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            {label}
          </Button>
        )}
      </div>
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
