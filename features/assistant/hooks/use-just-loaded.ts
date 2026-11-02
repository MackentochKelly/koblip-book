"use client"

import { useCallback, useSyncExternalStore } from "react"

// True for the first moments after the browser loaded the page, counted from
// the load itself, so moving between pages neither restarts nor brings it back:
// only loading the page again does.
export function useJustLoaded(milliseconds: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const left = Math.ceil(milliseconds - performance.now())
      if (left <= 0) return () => {}
      const timer = setTimeout(onChange, left)
      return () => clearTimeout(timer)
    },
    [milliseconds]
  )
  return useSyncExternalStore(
    subscribe,
    () => performance.now() < milliseconds,
    () => false
  )
}
