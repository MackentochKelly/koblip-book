"use client"

import { useEffect } from "react"

// A refresh starts at the top of the page, not where the visitor was.
// Scrolling to the top on load is not enough: iPhone Safari puts the old
// position back after it. So the browser is told not to put it back
// (`scrollRestoration = "manual"`, saved with the page for its next load),
// and the page also goes to the top on load. Moving between pages inside
// the app is unchanged (Next.js handles it), and a page the back button
// takes from the browser's back/forward cache comes back as it was.
// (developer.mozilla.org/docs/Web/API/History/scrollRestoration)
export function ScrollTopOnReload() {
  useEffect(() => {
    history.scrollRestoration = "manual"
    const [entry] = performance.getEntriesByType("navigation")
    if ((entry as PerformanceNavigationTiming | undefined)?.type === "reload") {
      window.scrollTo(0, 0)
    }
  }, [])
  return null
}
