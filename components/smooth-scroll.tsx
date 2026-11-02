"use client"

import { useEffect } from "react"
import { ReactLenis, useLenis } from "lenis/react"
import "lenis/dist/lenis.css"

// Mouse and trackpad scrolling glides to where the wheel points instead of
// jumping, on every page. Phones and tablets keep their own native scrolling
// (touch is not smoothed), scrolling boxes inside the page (sheets, chat,
// lists) scroll natively, and Reduce Motion turns the smoothing off.
// (github.com/darkroomengineering/lenis)
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        wheelMultiplier: 1,
        smoothWheel: true,
        anchors: true,
        allowNestedScroll: true,
        autoToggle: true,
        stopInertiaOnNavigate: true,
      }}
    >
      <PageLockStopsScroll />
      {children}
    </ReactLenis>
  )
}

// While a window, sheet or drawer is open, the page behind it stays still.
// Base UI locks the page by hiding the overflow of <html> or, when <html>
// isn't a scroll container (overlay scrollbars: macOS, phones), of <body>.
// Lenis's autoToggle only watches <html>, so a <body> lock is missed and the
// wheel still scrolls the page. This stops Lenis for a <body> lock too: the
// open window's own content keeps scrolling (allowNestedScroll), the page
// doesn't.
function PageLockStopsScroll() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    const html = document.documentElement
    const body = document.body
    const sync = () => {
      const locked = /hidden|clip/.test(getComputedStyle(body).overflowY)
      if (locked && !lenis.isStopped) lenis.stop()
      if (!locked && lenis.isStopped) lenis.start()
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(body, { attributes: true, attributeFilter: ["style"] })
    // With autoToggle, stop() and start() finish on <html>'s overflow
    // transition, so a lock that changes before then is checked again here.
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === html && event.propertyName.includes("overflow")) {
        sync()
      }
    }
    html.addEventListener("transitionend", onTransitionEnd)
    return () => {
      observer.disconnect()
      html.removeEventListener("transitionend", onTransitionEnd)
    }
  }, [lenis])

  return null
}
