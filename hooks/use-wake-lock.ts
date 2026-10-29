"use client"

import { useEffect } from "react"

// Keeps the screen on while `active` (e.g. talking live), with the Screen
// Wake Lock API (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
// The browser drops the lock when the page is hidden, so it is asked for
// again when the page comes back. Browsers without it, or that refuse it
// (low battery, power saving), just let the screen sleep as usual.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request("screen")
        if (stopped) void next.release()
        else lock = next
      } catch {
        // Refused: the screen may sleep.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void request()
    }
    void request()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      document.removeEventListener("visibilitychange", onVisible)
      void lock?.release()
    }
  }, [active])
}
