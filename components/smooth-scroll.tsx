"use client"

import { ReactLenis } from "lenis/react"
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
      {children}
    </ReactLenis>
  )
}
