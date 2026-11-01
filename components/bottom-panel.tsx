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

// A long sheet's two steps, like iOS's sheets: half the screen, floating,
// then the whole screen, edge to edge (Base UI's snap points; 1 is the full
// step, which Base UI marks data-expanded).
const HALF = 0.5
const STEPS = [HALF, 1]

// A phone panel: the stock Drawer as a bottom sheet. A short one floats at
// its content's height, slides to a new height when the content changes and
// swipes down to close. A long one opens half way and drags up to fill the
// screen. Keep it mounted and toggle `open` so it animates.
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
  // Taller than half the screen: it takes the two steps.
  const long = height !== null && height > window.innerHeight * HALF
  const [step, setStep] = React.useState<DrawerPrimitive.Root.SnapPoint | null>(HALF)
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      onOpenChangeComplete={(next) => {
        if (next) return
        // The next time it opens half way again.
        setStep(HALF)
        onClosed?.()
      }}
      snapPoints={long ? STEPS : undefined}
      // Always passed, so Base UI keeps it controlled; a short sheet has no
      // steps for it to apply to.
      snapPoint={step}
      onSnapPointChange={setStep}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerPrimitive.VirtualKeyboardProvider>
        <DrawerContent
          ref={popup}
          // Typing needs room: a long sheet fills the screen.
          onFocusCapture={(event) => {
            if (long && (event.target as HTMLElement).matches("input, textarea, [contenteditable]")) {
              setStep(1)
            }
          }}
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
            "min-h-[min(var(--drawer-content-max-height),calc(var(--drawer-keyboard-inset,0px)*1000))]",
            // Two steps: the full step stops under the status bar, and the
            // part below the screen at the half step is padded off, so the
            // buttons stay in view.
            "data-[swipe-axis=y]:data-snap-points:[--drawer-content-max-height:calc(100dvh-max(env(safe-area-inset-top),--spacing(4)))]",
            "data-snap-points:pb-[calc(var(--drawer-snap-point-offset,0px)+max(var(--drawer-keyboard-inset,0px),env(safe-area-inset-bottom)))]",
            "data-snap-points:transition-[transform,height,opacity,filter,margin,border-radius,padding]",
            // The full step fills the screen's width and bottom: no gap,
            // round only at the top.
            "data-snap-points:data-expanded:rounded-b-none data-snap-points:data-expanded:border-x-0 data-snap-points:data-expanded:border-b-0 data-snap-points:data-expanded:[--drawer-inset:0px]"
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
