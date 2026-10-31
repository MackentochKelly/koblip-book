"use client"

import { useState } from "react"

// An app's consent page in its own small window (OAuth popup); a blocked
// window opens it in this tab instead. `waiting` is true while the window
// is open; the page sets it back when the window says how it ended.
export function useConnectWindow() {
  const [waiting, setWaiting] = useState(false)

  function openWindow(url: string, name: string) {
    const popup = window.open(url, name, "popup,width=480,height=720")
    if (!popup) {
      // A route that leaves for the app, not a page: a full navigation.
      window.location.assign(url)
      return
    }
    setWaiting(true)
    const watch = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(watch)
        setWaiting(false)
      }
    }, 500)
  }

  return { waiting, setWaiting, openWindow }
}
