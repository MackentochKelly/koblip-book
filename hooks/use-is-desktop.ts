"use client"

import { useSyncExternalStore } from "react"

// Tailwind's md breakpoint, where the owner area becomes its computer layout.
const DESKTOP = "(min-width: 48rem)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

// False on the server and on phones, so anything costly a phone shouldn't
// run, like a moving canvas, is never even started there.
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false
  )
}
