"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

type Stop = "peek" | "middle" | "content" | "max"

// A bottom sheet's stops (Base UI snap points): it opens at its content's
// height and can be dragged to the bottom (title and buttons only), the
// middle of the screen or all the way up. Focusing a field takes it to the
// top, above the keyboard. Measured from the sheet itself, so the stops
// follow the content as it changes.
function useSheetStops(
  enabled: boolean,
  resetKey: string | undefined,
  {
    popup,
    scroll,
    inner,
  }: {
    popup: React.RefObject<HTMLDivElement | null>
    scroll: React.RefObject<HTMLDivElement | null>
    inner: React.RefObject<HTMLDivElement | null>
  }
) {
  const [heights, setHeights] = React.useState<Record<Stop, number> | null>(
    null
  )
  const [stop, setStop] = React.useState<Stop>("content")

  const measure = React.useCallback(() => {
    const sheet = popup.current
    const area = scroll.current
    const body = inner.current
    if (!sheet || !area || !body) return
    const padding = parseFloat(getComputedStyle(area).paddingTop) * 2
    // Everything that is not the scrolling middle: handle, title, buttons.
    const chrome = sheet.offsetHeight - area.clientHeight
    const max = sheet.offsetHeight
    const content = Math.round(
      Math.min(max, chrome + body.offsetHeight + padding)
    )
    const next = {
      peek: Math.round(Math.min(chrome, content)),
      middle: Math.round(window.innerHeight / 2),
      content,
      max: Math.round(max),
    }
    setHeights((current) =>
      current &&
      (Object.keys(next) as Stop[]).every(
        (key) => Math.abs(current[key] - next[key]) <= 1
      )
        ? current
        : next
    )
  }, [popup, scroll, inner])

  const measured = heights !== null
  React.useLayoutEffect(() => {
    if (!enabled) return
    // A ResizeObserver reports each node's size as soon as it starts
    // observing, so this also takes the first measurement.
    const observer = new ResizeObserver(measure)
    for (const node of [popup.current, inner.current]) {
      if (node) observer.observe(node)
    }
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [enabled, measure, measured, popup, inner])

  // A new step opens at its own content height again.
  const [lastKey, setLastKey] = React.useState(resetKey)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setStop("content")
  }

  if (!enabled || !heights) return { active: false as const }
  // The top stop is 1 (the sheet's full height).
  const value = (key: Stop) => (key === "max" ? 1 : heights[key])
  const points = [
    ...new Set(
      (["peek", "middle", "content"] as const)
        .map((key) => heights[key])
        .filter((height) => height < heights.max - 1)
    ),
  ].sort((a, b) => a - b)
  return {
    active: true as const,
    snapPoints: [...points, 1],
    snapPoint:
      stop === "content" && heights.content >= heights.max - 1
        ? 1
        : value(stop),
    onSnapPointChange: (point: number | string | null) => {
      if (point === null) return
      if (point === 1) {
        setStop("max")
        return
      }
      const found = (["content", "middle", "peek"] as const).find(
        (key) => heights[key] === point
      )
      if (found) setStop(found)
    },
    onFocusCapture: (event: React.FocusEvent) => {
      if (
        (event.target as HTMLElement).matches(
          'input, textarea, [contenteditable="true"]'
        )
      ) {
        setStop("max")
      }
    },
  }
}

// A phone panel: the stock Drawer as a bottom sheet, like Google Maps. It
// slides up edge to edge, swipes down to close and has three stops; its
// buttons ride up with the visible edge so they stay on screen. Keep it
// mounted and toggle `open` so it animates.
export function BottomPanel({
  open,
  onClose,
  onClosed,
  title,
  header,
  footer,
  contentKey,
  children,
}: {
  open: boolean
  onClose: () => void
  // Once it has finished sliding away.
  onClosed?: () => void
  title: string
  header?: React.ReactNode
  footer?: React.ReactNode
  // A new value (a new step) opens the sheet at its content height again.
  contentKey?: string
  children: React.ReactNode
}) {
  const popup = React.useRef<HTMLDivElement | null>(null)
  const scroll = React.useRef<HTMLDivElement | null>(null)
  const inner = React.useRef<HTMLDivElement | null>(null)
  const stops = useSheetStops(open, contentKey, { popup, scroll, inner })
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed?.()
      }}
      showSwipeHandle
      swipeDirection="down"
      {...(stops.active
        ? {
            snapPoints: stops.snapPoints,
            snapPoint: stops.snapPoint,
            onSnapPointChange: stops.onSnapPointChange,
          }
        : {})}
    >
      <DrawerPrimitive.VirtualKeyboardProvider>
        <DrawerContent
          ref={popup}
          onFocusCapture={stops.active ? stops.onFocusCapture : undefined}
          className={cn(
            "pb-[max(var(--drawer-keyboard-inset,0px),env(safe-area-inset-bottom))] [--drawer-content-max-height:calc(100dvh-3rem)]",
            // While the keyboard is open the sheet rises to its tallest.
            "min-h-[min(var(--drawer-content-max-height),calc(var(--drawer-keyboard-inset,0px)*1000))]"
          )}
        >
          {header ?? (
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
          )}
          <div
            ref={scroll}
            className={cn(
              // shadcn's scroll-fade: the list fades out under the title
              // and the buttons instead of being cut.
              "flex-1 scroll-fade overflow-y-auto p-4",
              // Below a lower stop, the hidden part is left as room so the
              // last lines can scroll into view.
              stops.active &&
                "pb-[calc(1rem+var(--drawer-snap-point-offset,0px))]"
            )}
          >
            <div ref={inner}>{children}</div>
          </div>
          {footer && (
            <DrawerFooter
              className={cn(
                stops.active &&
                  "translate-y-[calc(-1*var(--drawer-snap-point-offset,0px))] transition-[translate] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)]"
              )}
            >
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </DrawerPrimitive.VirtualKeyboardProvider>
    </Drawer>
  )
}
