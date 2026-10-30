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
export const PHONE_STATUS_BAR = 54
// A little room kept clear at the bottom, where the phone's home
// indicator sits (iOS keeps 34 points, too much in the small frame), so
// the page's bottom bar clears the rounded corners.
const HOME_AREA = 10
// The width of the hidden test frame that tells how this browser shrinks
// a page in a frame (see Shrink).
const PROBE_WIDTH = 100

// How the phone is shrunk to its box. CSS zoom first: it lays the page out
// and draws it at the smaller size, while a scale transform shrinks a
// drawn copy, which made the page's pinned tabs shake by a pixel while
// scrolling and let a slice of the text under them show (Chrome). But
// Safari doesn't carry zoom into a frame's page: the page gets a narrower
// screen and lays out squeezed (while still reporting the full width in
// innerWidth). A hidden test frame in a zoomed box tells which, by the
// width its page actually lays out at, and Safari gets the transform.
type Shrink = "zoom" | "transform"

// A real phone with a page running in it: the screen is drawn at the
// phone's own size, then the whole phone is shrunk to fit its box, so the
// page's words keep the phone's proportions instead of being drawn large.
// `className` sizes the box (give it a height); the phone keeps its shape
// inside it. `clearTop`: the page runs up under the status bar (a page
// that opens on a photo), instead of starting below it. `expanded`: the
// screen leaves the phone and fills the whole
// window (the frame's page stays as it is, no reload), with `topBar`
// pinned above it.
export function PhoneMockup({
  className,
  clearTop = false,
  expanded = false,
  topBar,
  children,
}: {
  className?: string
  clearTop?: boolean
  expanded?: boolean
  topBar?: React.ReactNode
  children: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [shrink, setShrink] = useState<Shrink | null>(null)

  useEffect(() => {
    const element = box.current
    if (!element) return
    const watcher = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / FRAME.width)
    })
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [])

  // While the screen fills the window, the page under it doesn't scroll.
  useEffect(() => {
    if (!expanded) return
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = "hidden"
    return () => {
      root.style.overflow = before
    }
  }, [expanded])

  // Expanded, nothing is shrunk: a fixed screen inside a zoomed or
  // transformed box would be shrunk or pinned to the box.
  const shrunk = !expanded && shrink !== null
  return (
    <div ref={box} className={cn("relative aspect-[450/920]", className)}>
      {!!scale && (
        <div
          className="absolute top-0 left-0"
          style={{
            width: FRAME.width,
            height: FRAME.height,
            // Shown once the test frame has said how to shrink.
            visibility: shrink === null ? "hidden" : undefined,
            ...(shrunk &&
              (shrink === "zoom"
                ? { zoom: scale }
                : { transform: `scale(${scale})`, transformOrigin: "0 0" })),
          }}
        >
          {shrink === null && (
            <div className="absolute top-0 left-0" style={{ zoom: scale }}>
              <iframe
                aria-hidden
                tabIndex={-1}
                srcDoc="<!doctype html><body style='margin:0'>"
                className="h-2.5"
                style={{ width: PROBE_WIDTH }}
                onLoad={(event) => {
                  const width =
                    event.currentTarget.contentDocument?.documentElement
                      .clientWidth
                  setShrink(
                    width && Math.abs(width - PROBE_WIDTH) > 1
                      ? "transform"
                      : "zoom"
                  )
                }}
              />
            </div>
          )}
          <div
            className={cn(
              "flex flex-col overflow-hidden bg-background",
              expanded ? "fixed inset-0 z-50" : "absolute"
            )}
            style={
              expanded
                ? undefined
                : {
                    left: SCREEN.left,
                    top: SCREEN.top,
                    width: SCREEN.width,
                    height: SCREEN.height,
                    borderRadius: SCREEN.radius,
                    paddingTop: clearTop ? 0 : PHONE_STATUS_BAR,
                    paddingBottom: HOME_AREA,
                  }
            }
          >
            {expanded && topBar}
            {children}
          </div>
          {/* The frame on top, so its edge covers the screen's. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size frame drawn at its own pixels and scaled with the phone */}
          <img
            src="/iphone-17-frame.png"
            alt=""
            width={FRAME.width}
            height={FRAME.height}
            className={cn(
              "pointer-events-none absolute inset-0 select-none",
              expanded && "hidden"
            )}
          />
        </div>
      )}
    </div>
  )
}
