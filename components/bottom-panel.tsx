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

// The sheet's height in px: what its content needs, up to its tallest.
// Set as a number (not "auto") so the stock height transition also slides
// on iPhone Safari, which can't animate to "auto". Measured from the sheet
// itself, so it follows the content as it changes.
function useSheetHeight(
  enabled: boolean,
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
  const [height, setHeight] = React.useState<number | null>(null)

  const measure = React.useCallback(() => {
    const sheet = popup.current
    const area = scroll.current
    const body = inner.current
    if (!sheet || !area || !body) return
    // While a sheet is open on top, this one is squeezed to its height;
    // measure again once it closes.
    if (sheet.hasAttribute("data-nested-drawer-open")) return
    const padding = parseFloat(getComputedStyle(area).paddingTop) * 2
    // Everything that is not the scrolling middle: handle, title, buttons.
    const chrome = sheet.offsetHeight - area.clientHeight
    const max = parseFloat(getComputedStyle(sheet).maxHeight)
    const next = Math.round(
      Math.min(
        Number.isFinite(max) ? max : window.innerHeight,
        chrome + body.offsetHeight + padding
      )
    )
    setHeight((current) =>
      current !== null && Math.abs(current - next) <= 1 ? current : next
    )
  }, [popup, scroll, inner])

  // The sheet mounts after `open` turns on (it is portalled), so the effect
  // waits for it rather than running once with nothing to watch.
  const [tries, setTries] = React.useState(0)
  React.useLayoutEffect(() => {
    if (!enabled) return
    if (!popup.current) {
      const frame = requestAnimationFrame(() => setTries((value) => value + 1))
      return () => cancelAnimationFrame(frame)
    }
    // A ResizeObserver reports each node's size as soon as it starts
    // observing, so this also takes the first measurement. The middle
    // changes size when the title or the buttons do.
    const observer = new ResizeObserver(measure)
    for (const node of [popup.current, scroll.current, inner.current]) {
      if (node) observer.observe(node)
    }
    // A sheet on top closing leaves this one's size as it was, so watch for
    // it too.
    const nested = new MutationObserver(measure)
    nested.observe(popup.current, {
      attributeFilter: ["data-nested-drawer-open"],
    })
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      nested.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [enabled, measure, tries, popup, scroll, inner])

  return enabled ? height : null
}

// A phone panel: the stock Drawer as a bottom sheet. It floats at its
// content's height, slides to a new height when the content changes and
// swipes down to close. Keep it mounted and toggle `open` so it animates.
export function BottomPanel({
  open,
  onClose,
  onClosed,
  title,
  header,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  // Once it has finished sliding away.
  onClosed?: () => void
  title: string
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const popup = React.useRef<HTMLDivElement | null>(null)
  const scroll = React.useRef<HTMLDivElement | null>(null)
  const inner = React.useRef<HTMLDivElement | null>(null)
  const height = useSheetHeight(open, { popup, scroll, inner })
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
    >
      <DrawerPrimitive.VirtualKeyboardProvider>
        <DrawerContent
          ref={popup}
          style={
            height === null
              ? undefined
              : ({ "--sheet-height": `${height}px` } as React.CSSProperties)
          }
          className={cn(
            "pb-[max(var(--drawer-keyboard-inset,0px),env(safe-area-inset-bottom))] [--drawer-content-max-height:calc(100dvh-3rem)]",
            // Base UI's own height (while a sheet is open on top) still wins.
            "[--drawer-content-height:var(--drawer-height,var(--sheet-height,auto))]",
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
            // A line between the list and the buttons.
            className={cn(
              "min-h-0 flex-1 overflow-y-auto p-4",
              footer && "border-b"
            )}
          >
            <div ref={inner}>{children}</div>
          </div>
          {footer && (
            <DrawerFooter className="pt-4">{footer}</DrawerFooter>
          )}
        </DrawerContent>
      </DrawerPrimitive.VirtualKeyboardProvider>
    </Drawer>
  )
}
