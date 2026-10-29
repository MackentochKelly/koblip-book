"use client"

import { useEffect, useSyncExternalStore } from "react"

// A view that takes the whole screen (the phone search) marks the page with
// data-full-screen on <html> while open, so parts that float over the page
// (the sticky header) step aside. It can't simply sit above them: it opens
// from inside a panel that keeps its own layers.
const ATTRIBUTE = "data-full-screen"

export function useMarkFullScreen(open: boolean) {
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.setAttribute(ATTRIBUTE, "")
    return () => root.removeAttribute(ATTRIBUTE)
  }, [open])
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: [ATTRIBUTE] })
  return () => observer.disconnect()
}

export function useIsFullScreen() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.hasAttribute(ATTRIBUTE),
    () => false
  )
}
