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
        "fixed top-2 right-2 left-2 z-50 mx-auto rounded-full transition-[translate,opacity,max-width,background-color,box-shadow] duration-300 ease-out *:transition-[height] *:duration-300 *:ease-out motion-reduce:transition-none *:motion-reduce:transition-none sm:top-3 sm:right-3 sm:left-3",
        // Scrolled: under 90% of the screen's width. iPhone Safari paints its
        // top bar solid behind a fixed element at least that wide (WebKit's
        // LocalFrameView::fixedContainerEdges), which would stop the page
        // showing under the status bar.
        scrolled
          ? cn("max-w-5/6 *:h-14 lg:max-w-3xl", frostedClassName)
          : "max-w-page",
        hidden && "-translate-y-full opacity-0"
      )}
    >
      {children}
    </div>
  )
}
