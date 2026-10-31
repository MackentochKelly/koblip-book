"use client"

import { ChevronRightIcon } from "@/components/ui/icons"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type { Sender } from "@/types/whatsapp"

// WhatsApp, opened from Manage on Integrations (WhatsApp's row or Koblip
// Chat's): which number sends (senderFor), when one does. On Koblip's number, "Use your own number" connects the
// business's Koblip Chat workspace; once connected, its workspace and how
// its messages stand, and Disconnect goes back to Koblip's number.
export function WhatsappPanel({
  open,
  onClose,
  sender,
  connection,
  connecting,
  onConnect,
  onDisconnect,
}: {
  open: boolean
  onClose: () => void
  sender: Sender | null
  connection: ChatConnection | null
  // The Koblip Chat window is open (useConnectWindow on the page).
  connecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const m = useOwnerMessages()
  const t = m.integrations
  const connected = !!connection && !connection.needsReconnect

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.whatsapp.name}
      footer={
        connected ? (
          <Button variant="outline" onClick={onDisconnect}>
            {t.whatsapp.disconnect}
          </Button>
        ) : (
          <Button onClick={onConnect} disabled={connecting}>
            {connecting && <Spinner data-icon="inline-start" />}
            {t.whatsapp.useOwnNumber}
            {!connecting && <ChevronRightIcon data-icon="inline-end" />}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        {sender && <p className="text-sm">{m.whatsapp.sendingFrom[sender]}</p>}
        {connected && (
          <p className="text-sm text-muted-foreground">
            {connection.messages === "ready"
              ? t.koblipChat.workspace(connection.workspaceName)
              : t.koblipChat.messages[connection.messages]}
          </p>
        )}
      </div>
    </ResponsivePanel>
  )
}
