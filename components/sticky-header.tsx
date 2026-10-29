"use client"

import {
  LayoutGroup,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react"
import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

// How far the page scrolls before the header turns into its pill, and
// before it may hide (it never hides near the top).
const SCROLLED_AT = 16
const HIDE_AFTER = 160
// How far the page must keep going one way before the header hides or
// comes back, so a finger's small wobble doesn't make it flicker.
const SCROLL_INTENT = 8

// The header's change of size: 350ms on the standard curve
// (docs/ui-rules/motion.md, the ease-standard token).
const LAYOUT_TRANSITION = { duration: 0.35, ease: [0.2, 0, 0, 1] } as const

// The frosted menu glass (dropdowns, selects), so the header matches them.
const frostedClassName =
  "bg-menu-glass shadow-lg ring-1 ring-glass-edge backdrop-blur-2xl backdrop-saturate-150"

// Keeps the header (a SiteHeader) on top of the public pages while they
// scroll. At the top it sits clear on the page, as if part of it; once
// scrolled it turns into a floating frosted pill. It fades away in place
// while scrolling down and comes back on a scroll up. Plain CSS
// transitions plus Motion for the change of size; Reduce Motion keeps
// only the fades. The page leaves room for it at the top.
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  // Where the current scroll direction started: the lowest point while
  // shown, the highest while hidden.
  const turnedAt = useRef(0)
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > SCROLLED_AT)
    if (y <= HIDE_AFTER) {
      setHidden(false)
      turnedAt.current = y
    } else if (hidden ? y > turnedAt.current : y < turnedAt.current) {
      turnedAt.current = y
    } else if (Math.abs(y - turnedAt.current) > SCROLL_INTENT) {
      setHidden(!hidden)
      turnedAt.current = y
    }
  })
  return (
    // Motion's layout animation slides the logo and buttons to their new
    // places when the header changes size (docs/ui-rules/motion.md:
    // transform only, never width or height). LayoutGroup lets them, inside
    // the page's header, which doesn't re-render, measure on each change.
    // layoutRoot: measured against the screen, as it's fixed.
    <LayoutGroup>
      <motion.div
        layoutRoot
        className={cn(
          // The hero's own inset, so at rest the header sits where it did.
          "fixed top-2 right-2 left-2 z-50 sm:top-3 sm:right-3 sm:left-3",
          hidden && "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "relative mx-auto max-w-page",
            // Scrolled: under 90% of the screen's width. iPhone Safari
            // paints its top bar solid behind a fixed element at least that
            // wide (WebKit's LocalFrameView::fixedContainerEdges), which
            // would stop the page showing under the status bar.
            scrolled ? "w-5/6 lg:max-w-3xl" : "w-full"
          )}
        >
          {/* The glass never animates: no fade, no change of size. Safari
              redraws a moving or fading blur every frame, which flashes. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 -z-10 rounded-full",
              frostedClassName,
              (!scrolled || hidden) && "invisible"
            )}
          />
          {/* Shown and hidden by fading and shrinking in place, never
              moving up across the screen's top edge, where Safari would
              catch it mid-way and paint its top bar solid until it next
              checks. */}
          <div
            className={cn(
              "origin-top transition-[scale,opacity] motion-reduce:scale-100",
              hidden
                ? "scale-95 opacity-0 duration-200 ease-exit"
                : "duration-300 ease-enter",
              scrolled && "*:h-14"
            )}
          >
            {children}
          </div>
        </div>
      </motion.div>
    </LayoutGroup>
  )
}

// One end of the header (the logo, the buttons): slides to its new place
// when the header changes size, keeping its own size.
export function StickyHeaderItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div layout="position" transition={LAYOUT_TRANSITION}>
      {children}
    </motion.div>
  )
}
