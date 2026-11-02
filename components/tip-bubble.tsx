"use client"

import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { POP } from "@/components/feature-preview"
import { Button } from "@/components/ui/button"
import { XIcon } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

// Room between the arrow and the bubble's rounded ends.
const ARROW_EDGE = 20

// A tip under its parent (which is `relative`), in the tooltip's look,
// with its arrow pointing up at `anchor`, and an X to hide it. It pops in
// again each time its words change. In the page, not a portal: it scrolls
// with the page under the fixed header and never takes the focus. Screen
// readers get the words from the page itself, so only the X is read here.
export function TipBubble({
  anchor,
  text,
  closeLabel,
  onClose,
  className,
}: {
  // What the arrow points at, found again when the words change.
  anchor: () => Element | null
  text: string
  closeLabel: string
  onClose: () => void
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [arrowX, setArrowX] = useState<number | null>(null)

  const place = useCallback(() => {
    const element = box.current
    const parent = element?.offsetParent
    const target = anchor()
    if (!element || !parent || !target) return
    const from = parent.getBoundingClientRect()
    const to = target.getBoundingClientRect()
    const center = to.left + to.width / 2 - from.left
    const bubble = element.getBoundingClientRect()
    const left = bubble.left - from.left
    setArrowX(
      Math.min(Math.max(center - left, ARROW_EDGE), bubble.width - ARROW_EDGE)
    )
  }, [anchor])

  // Follows the anchor when the words change, when a row it sits in
  // scrolls sideways, and when the screen turns or resizes.
  useEffect(() => {
    const parent = box.current?.offsetParent
    if (!parent) return
    place()
    const resize = new ResizeObserver(place)
    resize.observe(parent)
    // The bubble itself, when new words make it wider or narrower.
    if (box.current) resize.observe(box.current)
    parent.addEventListener("scroll", place, { capture: true, passive: true })
    return () => {
      resize.disconnect()
      parent.removeEventListener("scroll", place, { capture: true })
    }
  }, [place, text])

  return (
    <div
      ref={box}
      className={cn(
        "absolute top-full left-1/2 z-10 mt-3 w-max max-w-full -translate-x-1/2",
        className
      )}
    >
      <AnimatePresence mode="wait" initial>
        <motion.div
          key={text}
          {...POP}
          style={{ transformOrigin: arrowX === null ? "top" : `${arrowX}px 0` }}
          className="relative flex items-center gap-1 rounded-xl bg-foreground py-1 pr-1 pl-3 text-sm text-background shadow-lg"
        >
          {arrowX !== null && (
            <span
              aria-hidden
              style={{ left: arrowX }}
              className="absolute -top-1 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-foreground"
            />
          )}
          <span aria-hidden className="text-balance">
            {text}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={closeLabel}
            onClick={onClose}
            className="text-background hover:bg-background/15 hover:text-background"
          >
            <XIcon />
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
