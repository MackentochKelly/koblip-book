"use client"

import { CornerLeftUpIcon } from "@/components/ui/icons"

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useOwnerMessages } from "../i18n/provider"

// Replies: what each button does. Until messages have buttons (P6 in
// docs/plans/whatsapp-notifications.md) there is nothing to set.
export function WhatsappReplies() {
  const t = useOwnerMessages().whatsapp
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CornerLeftUpIcon />
        </EmptyMedia>
        <EmptyTitle>{t.repliesSoon}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
