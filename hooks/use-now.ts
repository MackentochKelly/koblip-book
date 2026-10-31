"use client"

import { useSyncExternalStore } from "react"

// The time now, renewed every half minute while anything shows it, for
// "3 minutes ago" lines. null on the server, where the time would differ
// from the browser's.

const EVERY_MS = 30_000

let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function tick() {
  now = Date.now()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    // Fresh as soon as something new shows it.
    now = Date.now()
    timer = setInterval(tick, EVERY_MS)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null
  )
}
