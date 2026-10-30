"use client"

import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"
import {
  CHAT_CONNECT_CHANNEL,
  type ChatConnectResult,
} from "@/types/chat-connect"

// The last page in the Chat window: tells the page that opened it how it
// ended and closes. Opened as a full page instead (the window was blocked),
// it goes back with the result: to Integrations, or to the admin area for
// Koblip's own connection.
export function ChatConnectDone({
  businessId,
  koblip,
  result,
}: {
  businessId: string
  koblip: boolean
  result: ChatConnectResult
}) {
  useEffect(() => {
    const channel = new BroadcastChannel(CHAT_CONNECT_CHANNEL)
    channel.postMessage({ businessId, koblip, result })
    channel.close()
    window.close()
    // Still open: not a window this site opened.
    const back = window.setTimeout(() => {
      window.location.replace(
        koblip
          ? `/admin?chat=${result}`
          : businessId
            ? `/dashboard/${encodeURIComponent(businessId)}/integrations?chat=${result}`
            : "/dashboard"
      )
    }, 300)
    return () => window.clearTimeout(back)
  }, [businessId, koblip, result])

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </main>
  )
}
