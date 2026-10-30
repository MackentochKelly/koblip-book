"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// The iPhone 17 frame (public/iphone-17-frame.png), in its own pixels: the
// whole picture, and the see-through screen inside it, which is the
// phone's real screen size in points (402 x 874), so a page in it lays out
// exactly as on that phone.
const FRAME = { width: 450, height: 920 }
const SCREEN = { left: 24, top: 23, width: 402, height: 874, radius: 60 }
// The phone's status bar, kept clear above the page (the Dynamic Island
// sits in it), as on the real phone.
const STATUS_BAR = 54

// A real phone with a page running in it: the screen is drawn at the
// phone's own size, then the whole phone is shrunk to fit its box, so the
// page's words keep the phone's proportions instead of being drawn large.
// Shrunk with CSS zoom, not a scale transform: zoom lays the page out and
// draws it at the smaller size, while a transform shrinks a drawn copy,
// which made the page's pinned tabs shake by a pixel while scrolling and
// let a slice of the text under them show. `className` sizes the box (give it a height); the phone keeps
// its shape inside it.
export function PhoneMockup({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  useEffect(() => {
    const element = box.current
    if (!element) return
    const watcher = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / FRAME.width)
    })
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [])

  return (
    <div
      ref={box}
      className={cn("relative aspect-[450/920] max-w-full", className)}
    >
      {scale !== null && (
        <div
          className="absolute top-0 left-0"
          style={{
            width: FRAME.width,
            height: FRAME.height,
            zoom: scale,
          }}
        >
          <div
            className="absolute flex flex-col overflow-hidden bg-background"
            style={{
              left: SCREEN.left,
              top: SCREEN.top,
              width: SCREEN.width,
              height: SCREEN.height,
              borderRadius: SCREEN.radius,
              paddingTop: STATUS_BAR,
            }}
          >
            {children}
          </div>
          {/* The frame on top, so its edge covers the screen's. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size frame drawn at its own pixels and scaled with the phone */}
          <img
            src="/iphone-17-frame.png"
            alt=""
            width={FRAME.width}
            height={FRAME.height}
            className="pointer-events-none absolute inset-0 select-none"
          />
        </div>
      )}
    </div>
  )
}
