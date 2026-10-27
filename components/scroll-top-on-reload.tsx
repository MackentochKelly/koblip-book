"use client"

import { useEffect } from "react"

// A refresh starts at the top of the page, not where the visitor was. The
// back button still returns to where they were: a page kept in the
// browser's back/forward cache (`persisted`) is left alone.
// (developer.mozilla.org/docs/Web/API/History/scrollRestoration)
export function ScrollTopOnReload() {
  useEffect(() => {
    const [entry] = performance.getEntriesByType("navigation")
    if ((entry as PerformanceNavigationTiming | undefined)?.type === "reload") {
      window.scrollTo(0, 0)
    }
    const onHide = (event: PageTransitionEvent) => {
      if (!event.persisted) window.scrollTo(0, 0)
    }
    window.addEventListener("pagehide", onHide)
    return () => window.removeEventListener("pagehide", onHide)
  }, [])
  return null
}
