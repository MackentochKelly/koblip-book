"use client"

import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"

// The last page in an app's connect window (Koblip Chat, Google Calendar):
// tells the page that opened it how it ended, on a same-site channel, and
// closes. Opened as a full page instead (the window was blocked), it goes
// `back` with the result.
export function ConnectDone({
  channel,
  message,
  back,
}: {
  channel: string
  message: unknown
  back: string
}) {
  useEffect(() => {
    const broadcast = new BroadcastChannel(channel)
    broadcast.postMessage(message)
    broadcast.close()
    window.close()
    // Still open: not a window this site opened.
    const timeout = window.setTimeout(() => window.location.replace(back), 300)
    return () => window.clearTimeout(timeout)
  }, [channel, message, back])

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </main>
  )
}
