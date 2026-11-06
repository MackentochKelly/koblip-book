"use client"

import { useLayoutEffect, useRef } from "react"

// A big number with something beside it (a stat's icon): at its own size
// when it fits its box (the parent element), and shrunk just enough when it
// doesn't, like iOS's minimumScaleFactor, so a long amount is never cut off
// and never runs into its neighbour. It shrinks by zoom, so parts with a
// size of their own (a currency sign) shrink with it.
export function FitText({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const text = useRef<HTMLSpanElement>(null)
  // After every render, since a new number can be longer.
  useLayoutEffect(() => {
    const element = text.current
    const box = element?.parentElement
    if (!element || !box) return
    let live = true
    let room = -1
    const fit = () => {
      room = box.clientWidth
      element.style.removeProperty("zoom")
      const width = element.scrollWidth
      if (width <= room) return
      element.style.setProperty(
        "zoom",
        String(Math.floor((room / width) * 100) / 100)
      )
    }
    fit()
    // The page's font can arrive after the first measure.
    document.fonts?.ready.then(() => live && fit())
    const observer = new ResizeObserver(() => {
      if (box.clientWidth !== room) fit()
    })
    observer.observe(box)
    return () => {
      live = false
      observer.disconnect()
    }
  })
  return (
    <span ref={text} className={className}>
      {children}
    </span>
  )
}
