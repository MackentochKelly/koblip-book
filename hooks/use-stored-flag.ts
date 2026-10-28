"use client"

import { useCallback, useSyncExternalStore } from "react"

// A yes/no this device remembers (localStorage), like "Don't show again".
// It reads false on the server, before it is set, and when the browser
// blocks storage; every screen using the same key updates together.
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

export function useStoredFlag(key: string): [boolean, () => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false
  )
  const set = useCallback(() => {
    try {
      window.localStorage.setItem(key, "1")
    } catch {
      // Blocked storage: the flag stays off and the screen still works.
    }
    for (const listener of listeners) listener()
  }, [key])
  return [value, set]
}
