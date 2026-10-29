"use client"

import { useMotionValueEvent, useScroll } from "motion/react"
import { useState } from "react"

import { cn } from "@/lib/utils"

// How far the page scrolls before the header turns into its pill, and
// before it may hide (it never hides near the top).
const SCROLLED_AT = 16
const HIDE_AFTER = 160

// The frosted menu glass (dropdowns, selects), so the header matches them.
const frostedClassName =
  "bg-menu-glass shadow-lg ring-1 ring-glass-edge backdrop-blur-2xl backdrop-saturate-150"

// Keeps the header (a SiteHeader) on top of the public pages while they
// scroll. At the top it sits clear on the page, as if part of it; once
// scrolled it turns into a floating frosted pill. It slides away while
// scrolling down and comes back on the first scroll up. Plain CSS
// transitions; Reduce Motion drops the movement. The page leaves room for
// it at the top.
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  useMotionValueEvent(scrollY, "change", (y) => {
    const down = y > (scrollY.getPrevious() ?? 0)
    setScrolled(y > SCROLLED_AT)
    setHidden(down && y > HIDE_AFTER)
  })
  return (
    <div
      className={cn(
        // At rest: the hero's own inset, so the header sits where it did.
        "fixed inset-x-0 top-0 z-50 p-2 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none sm:p-3",
        hidden && "-translate-y-full opacity-0"
      )}
    >
      <div
        className={cn(
          "mx-auto rounded-full transition-[max-width,background-color,box-shadow] duration-300 ease-out *:transition-[height] *:duration-300 *:ease-out motion-reduce:transition-none *:motion-reduce:transition-none",
          scrolled ? cn("max-w-3xl *:h-14", frostedClassName) : "max-w-5xl"
        )}
      >
        {children}
      </div>
    </div>
  )
}
