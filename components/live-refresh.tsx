"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// Reloads the page's server data every `seconds` while the tab is shown
// (Next's router.refresh: what the visitor typed or opened stays), so new
// rows appear by themselves. Hidden tabs skip the reload; coming back to
// the tab reloads once straight away.
export function LiveRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh()
      }
    }
    const timer = setInterval(refresh, seconds * 1000)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router, seconds])
  return null
}
