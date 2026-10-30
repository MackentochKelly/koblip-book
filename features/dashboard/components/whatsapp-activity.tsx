"use client"

import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { useOwnerMessages } from "../i18n/provider"
import type { NotificationSend } from "../types/notifications"

// Activity: the latest messages, who, when, and whether they went.
export function WhatsappActivity({
  history,
  timeZone,
}: {
  history: NotificationSend[]
  timeZone: string
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const when = new Intl.DateTimeFormat(m.locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.noHistory}</p>
  }
  return (
    <ItemGroup className="gap-2">
      {history.map((send) => {
        const shown = send.state === "sent" && send.delivery ? send.delivery : send.state
        const reason = send.reason && (t.reasons[send.reason] ?? t.reasons.other)
        return (
          <Item key={send.id} variant="outline" size="sm">
            <ItemContent className="min-w-0">
              <ItemTitle>{t.names[send.message]}</ItemTitle>
              <ItemDescription>
                {[send.customerName, when.format(new Date(send.at)), reason]
                  .filter(Boolean)
                  .join(" · ")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge
                variant={
                  shown === "failed" ? "destructive" : shown === "skipped" || shown === "pending" ? "outline" : "secondary"
                }
              >
                {t.states[shown] ?? shown}
              </Badge>
            </ItemActions>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
