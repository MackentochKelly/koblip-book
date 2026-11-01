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

type Size = { fit: number; max: number }

// What the sheet's content needs (`fit`) and its tallest (`max`), in px.
// Heights are set as numbers (not "auto") so the stock height transition
// also slides on iPhone Safari, which can't animate to "auto". Measured from
// the sheet itself, so it follows the content as it changes.
function useSheetSize(
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
  const [size, setSize] = React.useState<Size | null>(null)

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
    const next = {
      fit: Math.round(chrome + body.offsetHeight + padding),
      max: Math.round(Number.isFinite(max) ? max : window.innerHeight),
    }
    setSize((current) =>
      current &&
      Math.abs(current.fit - next.fit) <= 1 &&
      Math.abs(current.max - next.max) <= 1
        ? current
        : next
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

  return enabled ? size : null
}

// A long sheet rests at two heights, like iOS sheets: half the screen,
// floating, and full, anchored to the screen's edges. A sheet up to LONG of
// the screen just floats at its content's height.
type Step = "half" | "full"
const HALF = 0.5
const LONG = 0.6
// How far a finger moves the sheet to the other step.
const DRAG_UP = 12
const DRAG_DOWN = 48

// Drags between the two steps, as on iOS: up from half grows it to full;
// down from full (with its list at the top) brings it back to half. Base UI
// keeps the touch for its own swipe and stops it reaching the sheet, so this
// listens on the window first, and only watches. It runs before Base UI's
// own swipe ends, so `from` keeps the step the drag started at.
function useStepDrag(
  enabled: boolean,
  step: React.RefObject<Step>,
  from: React.RefObject<Step | null>,
  setStep: (step: Step) => void,
  {
    popup,
    scroll,
  }: {
    popup: React.RefObject<HTMLDivElement | null>
    scroll: React.RefObject<HTMLDivElement | null>
  }
) {
  React.useEffect(() => {
    if (!enabled) return
    let start: { y: number; atTop: boolean } | null = null
    let toHalf = false
    const onStart = (event: TouchEvent) => {
      toHalf = false
      start =
        event.touches.length === 1 &&
        event.target instanceof Node &&
        popup.current?.contains(event.target)
          ? {
              y: event.touches[0].clientY,
              // Down on a list that is scrolled away is the list's own scroll.
              atTop:
                !scroll.current?.contains(event.target) ||
                scroll.current.scrollTop <= 0,
            }
          : null
      from.current = start ? step.current : null
    }
    const onMove = (event: TouchEvent) => {
      if (!start) return
      const moved = event.touches[0].clientY - start.y
      if (step.current === "half" && moved < -DRAG_UP) {
        setStep("full")
        start = null
      } else if (step.current === "full" && start.atTop && moved > DRAG_DOWN) {
        toHalf = true
      }
    }
    const onEnd = () => {
      if (toHalf) setStep("half")
      start = null
      toHalf = false
    }
    const options = { capture: true, passive: true }
    window.addEventListener("touchstart", onStart, options)
    window.addEventListener("touchmove", onMove, options)
    window.addEventListener("touchend", onEnd, options)
    window.addEventListener("touchcancel", onEnd, options)
    return () => {
      window.removeEventListener("touchstart", onStart, options)
      window.removeEventListener("touchmove", onMove, options)
      window.removeEventListener("touchend", onEnd, options)
      window.removeEventListener("touchcancel", onEnd, options)
    }
  }, [enabled, step, from, setStep, popup, scroll])
}

// A phone panel: the stock Drawer as a bottom sheet. A short one floats at
// its content's height and slides to a new height when the content changes.
// A long one opens at half the screen, floating; dragging up, tapping its
// handle or typing in it grows it to full, edge to edge; dragging down goes
// back to half, then closes. Keep it mounted and toggle `open` so it
// animates.
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
  // Shown from opening until it has slid away, so its size and step hold
  // while it closes.
  const [shown, setShown] = React.useState(open)
  if (open && !shown) setShown(true)
  const size = useSheetSize(shown, { popup, scroll, inner })

  const [step, setStepState] = React.useState<Step>("half")
  const stepRef = React.useRef<Step>("half")
  const setStep = React.useCallback((next: Step) => {
    stepRef.current = next
    setStepState(next)
  }, [])

  const long = !!size && size.fit > size.max * LONG
  const full = long && step === "full"
  const dragFrom = React.useRef<Step | null>(null)
  useStepDrag(long, stepRef, dragFrom, setStep, { popup, scroll })
  const height = !size
    ? null
    : !long
      ? Math.min(size.fit, size.max)
      : full
        ? Math.min(size.fit, size.max)
        : Math.round(size.max * HALF)

  return (
    <Drawer
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        // Swiping down from full rests at half, as on iOS.
        if (details.reason === "swipe" && long && dragFrom.current === "full") {
          details.cancel()
          setStep("half")
          return
        }
        onClose()
      }}
      onOpenChangeComplete={(next) => {
        if (next) return
        setShown(false)
        // The next time it opens at half again.
        setStep("half")
        onClosed?.()
      }}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerPrimitive.VirtualKeyboardProvider>
        <DrawerContent
          ref={popup}
          data-steps={long ? "" : undefined}
          data-full={full ? "" : undefined}
          // Typing needs room: the sheet grows to full (and stays there if
          // it only becomes long later).
          onFocusCapture={(event) => {
            if ((event.target as HTMLElement).matches("input, textarea, [contenteditable]")) {
              setStep("full")
            }
          }}
          // Tapping the handle moves to the other step.
          onClick={(event) => {
            if (long && (event.target as HTMLElement).closest('[data-slot="drawer-swipe-handle"]')) {
              setStep(full ? "half" : "full")
            }
          }}
          style={
            height === null
              ? undefined
              : ({ "--sheet-height": `${height}px` } as React.CSSProperties)
          }
          className={cn(
            "pb-[max(var(--drawer-keyboard-inset,0px),env(safe-area-inset-bottom))]",
            // Its tallest: just under the status bar. The same variant as the
            // stock rule, plus the slot, so this one wins.
            "data-[slot=drawer-popup]:data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-env(safe-area-inset-top)-(--spacing(2)))]",
            // Base UI's own height (while a sheet is open on top) still wins.
            "[--drawer-content-height:var(--drawer-height,var(--sheet-height,auto))]",
            // While the keyboard is open the sheet rises to its tallest.
            "min-h-[min(var(--drawer-content-max-height),calc(var(--drawer-keyboard-inset,0px)*1000))]",
            // Between the steps its edges and corners slide with its height.
            "data-steps:transition-[transform,height,opacity,filter,margin,border-radius]",
            // Full: anchored to the screen's sides and bottom, round only at
            // the top.
            "data-full:rounded-b-none data-full:border-x-0 data-full:border-b-0 data-full:[--drawer-inset:0px]"
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
              "min-h-0 flex-1 p-4",
              // At half the list doesn't scroll: a drag on it grows the sheet
              // first, as on iOS.
              long && !full ? "overflow-hidden" : "overflow-y-auto",
              // A line between the list and the buttons.
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
