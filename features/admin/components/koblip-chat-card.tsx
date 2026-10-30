"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  CHAT_CONNECT_CHANNEL,
  type ChatConnectMessage,
  type ChatConnectResult,
} from "@/types/chat-connect"
import { useAdminMessages } from "../i18n/provider"

// Koblip's own Koblip Chat workspace, the number every business sends from
// until it connects its own (K1). Connect opens Chat's consent page in a
// small window, like a business's Integrations page.
export function KoblipChatCard({
  connection,
  result,
  disconnect,
}: {
  connection: { workspaceName: string; needsReconnect: boolean } | null
  // How a Chat window opened as a full page ended (?chat=), shown once.
  result: ChatConnectResult | null
  // Passed in by the page (it lives with the Chat connection code).
  disconnect: () => Promise<{ ok: true }>
}) {
  const t = useAdminMessages().koblipChat
  const router = useRouter()
  const [waiting, setWaiting] = useState(false)
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()

  // The Chat window says how it ended on a same-site channel. Cancel says
  // nothing. One toast id, so hearing the same ending twice shows it once.
  useEffect(() => {
    function ended(next: ChatConnectResult) {
      setWaiting(false)
      if (next === "connected") {
        router.refresh()
        toast.success(t.connectedToast, { id: CHAT_CONNECT_CHANNEL })
      } else if (next === "failed") {
        toast.error(t.failed, { id: CHAT_CONNECT_CHANNEL })
      }
    }
    if (result) {
      ended(result)
      router.replace("/admin")
    }
    const channel = new BroadcastChannel(CHAT_CONNECT_CHANNEL)
    channel.onmessage = (event: MessageEvent<ChatConnectMessage>) => {
      if (event.data?.koblip) ended(event.data.result)
    }
    return () => channel.close()
  }, [result, router, t])

  // A blocked window opens Chat in this tab instead.
  function connect() {
    const url = "/api/chat/connect/koblip"
    const chat = window.open(url, "koblip-chat-connect", "popup,width=480,height=720")
    if (!chat) {
      // A route that leaves for Koblip Chat, not a page: a full navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(url)
      return
    }
    setWaiting(true)
    const watch = window.setInterval(() => {
      if (chat.closed) {
        window.clearInterval(watch)
        setWaiting(false)
      }
    }, 500)
  }

  function remove() {
    setAsking(false)
    startTransition(async () => {
      const done = await disconnect().catch(() => null)
      if (done?.ok) {
        router.refresh()
        toast.success(t.disconnectedToast)
      } else {
        toast.error(t.failed)
      }
    })
  }

  const busy = waiting || pending
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>
          {!connection
            ? t.notConnected
            : connection.needsReconnect
              ? t.reconnectNeeded(connection.workspaceName)
              : t.connected(connection.workspaceName)}
        </CardDescription>
        <CardAction>
          {connection && !connection.needsReconnect ? (
            <Button variant="outline" disabled={busy} onClick={() => setAsking(true)}>
              {pending && <Spinner data-icon="inline-start" />}
              {t.disconnect}
            </Button>
          ) : (
            <Button disabled={busy} onClick={connect}>
              {waiting && <Spinner data-icon="inline-start" />}
              {connection ? t.reconnect : t.connect}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.disconnectTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.disconnectText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              {t.disconnect}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
