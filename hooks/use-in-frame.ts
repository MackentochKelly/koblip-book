"use client"

import { useSyncExternalStore } from "react"

// Never changes while the page is open.
function subscribe() {
  return () => {}
}

// True when this page is shown inside another page's frame (the home
// page's phone). False on the server, so framed-only parts appear after
// hydration.
export function useInFrame(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.self !== window.top,
    () => false
  )
}
