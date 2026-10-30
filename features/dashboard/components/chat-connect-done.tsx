"use client"

import { useEffect } from "react"

import { Spinner } from "@/components/ui/spinner"
import {
  CHAT_CONNECT_CHANNEL,
  type ChatConnectResult,
} from "../types/chat-connection"

// The last page in the Chat window: tells the Integrations page how it
// ended and closes. Opened as a full page instead (the window was blocked),
// it goes back to Integrations with the result.
export function ChatConnectDone({
  businessId,
  result,
}: {
  businessId: string
  result: ChatConnectResult
}) {
  useEffect(() => {
    const channel = new BroadcastChannel(CHAT_CONNECT_CHANNEL)
    channel.postMessage({ businessId, result })
    channel.close()
    window.close()
    // Still open: not a window this site opened.
    const back = window.setTimeout(() => {
      window.location.replace(
        businessId
          ? `/dashboard/${encodeURIComponent(businessId)}/integrations?chat=${result}`
          : "/dashboard"
      )
    }, 300)
    return () => window.clearTimeout(back)
  }, [businessId, result])

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </main>
  )
}
