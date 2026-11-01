"use client"

import { animate, motion, useMotionValue, type PanInfo } from "motion/react"
import { useLayoutEffect, useRef } from "react"

import { DRAG_RULES } from "@/lib/drag-rules"

type Side = "left" | "right"

// Where the button rests: a side, and how high up that side (0 = bottom,
// 1 = top), so the spot still fits after the screen changes size.
interface Spot {
  side: Side
  rise: number
}

function readSpot(key: string): Spot | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null")
    if (
      (saved?.side === "left" || saved?.side === "right") &&
      typeof saved.rise === "number"
    ) {
      return { side: saved.side, rise: Math.min(1, Math.max(0, saved.rise)) }
    }
  } catch {}
  return null
}

function saveSpot(key: string, spot: Spot) {
  try {
    localStorage.setItem(key, JSON.stringify(spot))
  } catch {}
}

// A floating button people can drag anywhere on the screen, like a phone's
// floating shortcut: let go and it glides to the nearest side, and it comes
// back to that spot next time. It starts at the bottom right, clear of the
// phone's bottom bar, and never leaves the screen's safe area. A tap still
// works as a tap; a drag never counts as one (motion.dev/docs/react-drag).
export function DraggableFloat({
  id,
  children,
}: {
  // Names the spot this button keeps in the browser.
  id: string
  children: React.ReactNode
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const key = DRAG_RULES.storagePrefix + id

  // How far the button can travel left and up from its bottom-right start.
  function room() {
    const area = areaRef.current
    const item = itemRef.current
    if (!area || !item) {
      return null
    }
    return {
      across: area.clientWidth - item.offsetWidth,
      up: area.clientHeight - item.offsetHeight,
    }
  }

  // Put the button back where it was left last time, before it is drawn.
  useLayoutEffect(() => {
    const spot = readSpot(key)
    const space = room()
    if (!spot || !space) {
      return
    }
    x.set(spot.side === "left" ? -space.across : 0)
    y.set(-spot.rise * space.up)
  }, [key, x, y])

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    const space = room()
    if (!space) {
      return
    }
    const side: Side = x.get() < -space.across / 2 ? "left" : "right"
    animate(x, side === "left" ? -space.across : 0, {
      ...DRAG_RULES.snap,
      velocity: info.velocity.x,
    })
    const rise = space.up > 0 ? Math.min(1, Math.max(0, -y.get() / space.up)) : 0
    saveSpot(key, { side, rise })
  }

  return (
    <div
      ref={areaRef}
      className="pointer-events-none fixed top-[max(--spacing(4),env(safe-area-inset-top))] right-[max(--spacing(4),env(safe-area-inset-right))] bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))] left-[max(--spacing(4),env(safe-area-inset-left))] z-30 md:bottom-[max(--spacing(6),env(safe-area-inset-bottom))]"
    >
      <motion.div
        ref={itemRef}
        drag
        dragConstraints={areaRef}
        dragMomentum={false}
        style={{ x, y }}
        onPointerDownCapture={() => {
          dragged.current = false
        }}
        onDragStart={() => {
          dragged.current = true
        }}
        onDragEnd={handleDragEnd}
        // The browser still fires a click when a drag ends on the button;
        // only a real tap may open it.
        onClickCapture={(event) => {
          if (dragged.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        className="pointer-events-auto absolute right-0 bottom-0 cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  )
}
