"use client"

import { animate, motion, useMotionValue, type PanInfo } from "motion/react"
import { useLayoutEffect, useRef } from "react"

import { DRAG_RULES } from "@/lib/drag-rules"

// The screen corner the button rests in.
interface Corner {
  side: "left" | "right"
  edge: "top" | "bottom"
}

function readCorner(key: string): Corner | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null")
    if (
      (saved?.side === "left" || saved?.side === "right") &&
      (saved?.edge === "top" || saved?.edge === "bottom")
    ) {
      return { side: saved.side, edge: saved.edge }
    }
  } catch {}
  return null
}

function saveCorner(key: string, corner: Corner) {
  try {
    localStorage.setItem(key, JSON.stringify(corner))
  } catch {}
}

// Where a throw at this speed (px per second) would come to rest.
function project(velocity: number) {
  const rate = DRAG_RULES.deceleration
  return ((velocity / 1000) * rate) / (1 - rate)
}

// A floating button people can drag anywhere on the screen, like the
// Next.js dev button: let go (or flick it) and it glides into the nearest
// corner, and it comes back to that corner next time. It starts at the
// bottom right, clear of the phone's bottom bar, and never leaves the
// screen's safe area, even when the window changes size. A tap still works
// as a tap; a drag never counts as one (motion.dev/docs/react-drag).
export function DraggableFloat({
  id,
  children,
}: {
  // Names the corner this button keeps in the browser.
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

  // Put the button back in its last corner, before it is drawn and whenever
  // the window changes size.
  useLayoutEffect(() => {
    const place = () => {
      const corner = readCorner(key)
      const space = room()
      if (!corner || !space) {
        return
      }
      x.set(corner.side === "left" ? -space.across : 0)
      y.set(corner.edge === "top" ? -space.up : 0)
    }
    place()
    const observer = new ResizeObserver(place)
    if (areaRef.current) {
      observer.observe(areaRef.current)
    }
    return () => observer.disconnect()
  }, [key, x, y])

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    const space = room()
    if (!space) {
      return
    }
    const corner: Corner = {
      side: x.get() + project(info.velocity.x) < -space.across / 2 ? "left" : "right",
      edge: y.get() + project(info.velocity.y) < -space.up / 2 ? "top" : "bottom",
    }
    animate(x, corner.side === "left" ? -space.across : 0, {
      ...DRAG_RULES.snap,
      velocity: info.velocity.x,
    })
    animate(y, corner.edge === "top" ? -space.up : 0, {
      ...DRAG_RULES.snap,
      velocity: info.velocity.y,
    })
    saveCorner(key, corner)
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
