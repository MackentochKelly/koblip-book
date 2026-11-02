"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
    const style = getComputedStyle(area)
    const padding =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
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

// iOS's medium sheet: half the screen.
const MEDIUM = 0.5

// Whether this panel opens on top of another one.
const StackedContext = React.createContext(false)

// The one phone panel: the stock Drawer as a bottom sheet. It always opens
// at its content's height and slides to a new height when the content
// changes. Up to half the screen it floats; taller, it is anchored to the
// screen's sides and bottom like an iOS large sheet. Keep it mounted and
// toggle `open` so it animates.
export function BottomPanel({
  open,
  onClose,
  onClosed,
  title,
  description,
  header,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  // Once it has finished sliding away.
  onClosed?: () => void
  title: string
  // One short line under the title.
  description?: string
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const popup = React.useRef<HTMLDivElement | null>(null)
  const scroll = React.useRef<HTMLDivElement | null>(null)
  const inner = React.useRef<HTMLDivElement | null>(null)
  const stacked = React.useContext(StackedContext)
  // Shown from opening until it has slid away, so its size holds while it
  // closes.
  const [shown, setShown] = React.useState(open)
  if (open && !shown) setShown(true)
  // Once it has slid in. Until then it takes its edges at once, so it rises
  // already the right width.
  const [settled, setSettled] = React.useState(false)
  const size = useSheetSize(shown, { popup, scroll, inner })
  const height = size ? Math.min(size.fit, size.max) : null
  // Taller than iOS's medium sheet (half the screen) it is a large sheet:
  // anchored to the screen's edges.
  const full = !!size && height !== null && height > size.max * MEDIUM

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      onOpenChangeComplete={(next) => {
        setSettled(next)
        if (next) return
        setShown(false)
        onClosed?.()
      }}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerPrimitive.VirtualKeyboardProvider>
        <DrawerContent
          ref={popup}
          data-full={full ? "" : undefined}
          style={
            height === null
              ? undefined
              : ({ "--sheet-height": `${height}px` } as React.CSSProperties)
          }
          className={cn(
            "pb-[max(var(--drawer-keyboard-inset,0px),env(safe-area-inset-bottom))]",
            // Its tallest: just under the status bar. The same variant as the
            // stock rule, plus the slot, so this one wins.
            "data-[slot=drawer-popup]:data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-env(safe-area-inset-top)-(--spacing(2))-var(--sheet-stack-gap,0px))]",
            // On top of another panel it stops a peek lower, so the one
            // behind keeps its place under the status bar, like iOS.
            stacked && "[--sheet-stack-gap:var(--peek)]",
            // Base UI's own height (while a sheet is open on top) still wins.
            "[--drawer-content-height:var(--drawer-height,var(--sheet-height,auto))]",
            // While the keyboard is open the sheet rises to its tallest.
            "min-h-[min(var(--drawer-content-max-height),calc(var(--drawer-keyboard-inset,0px)*1000))]",
            // When it grows to full its edges and corners slide with its
            // height.
            settled &&
              "transition-[transform,height,opacity,filter,margin,border-radius]",
            // Full: anchored to the screen's sides and bottom, round only at
            // the top.
            "data-full:rounded-b-none data-full:border-x-0 data-full:border-b-0 data-full:[--drawer-inset:0px]",
            // Pulled up past where it rests, the strip under it is the
            // sheet's colour, so no gap opens at the bottom.
            "data-full:[--drawer-bleed-background:var(--color-popover)]"
          )}
        >
          {header ?? (
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </DrawerHeader>
          )}
          <div
            ref={scroll}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4",
              // A line between the list and the buttons, with room above it.
              footer && "border-b pb-16"
            )}
          >
            <div ref={inner}>
              <StackedContext.Provider value>
                {children}
              </StackedContext.Provider>
            </div>
          </div>
          {footer && <DrawerFooter className="pt-4">{footer}</DrawerFooter>}
        </DrawerContent>
      </DrawerPrimitive.VirtualKeyboardProvider>
    </Drawer>
  )
}
