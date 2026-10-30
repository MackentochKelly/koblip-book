"use client"

import { MessageCircleIcon } from "@/components/ui/icons"

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"

// Overview: which Koblip Chat workspace sends the messages and where they
// stand.
export function WhatsappOverview({ connection }: { connection: ChatConnection | null }) {
  const m = useOwnerMessages()
  if (!connection) return null
  const state = connection.messages
  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <MessageCircleIcon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{connection.workspaceName}</ItemTitle>
        {/* The whole status, never cut short (Spanish runs longer). */}
        <ItemDescription className="line-clamp-none">
          {state === "ready" ? m.whatsapp.ready : m.integrations.koblipChat.messages[state]}
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}
