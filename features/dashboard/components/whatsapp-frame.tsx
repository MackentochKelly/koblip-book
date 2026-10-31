"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter, useSelectedLayoutSegment } from "next/navigation"
import { MessageCircleIcon } from "@/components/ui/icons"

import { SectionParts } from "@/components/section-parts"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { refreshChatMessages } from "../api/chat-connection"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type { Sender } from "../types/notifications"

// The page's parts, in order. Overview is the page itself; each other part
// is its own route below it (app/(owner)/dashboard/[businessId]/whatsapp/).
const PARTS = [
  "overview",
  "messages",
  "alerts",
  "timing",
  "replies",
  "activity",
] as const

type Part = (typeof PARTS)[number]

// The WhatsApp page's frame around its parts: the shared SectionParts, as in
// the admin (D19). A business without its own Koblip Chat workspace sends
// from Koblip's number (K4), so the page opens for it too.
export function WhatsappFrame({
  businessId,
  connection,
  sender,
  children,
}: {
  businessId: string
  connection: ChatConnection | null
  sender: Sender | null
  children: React.ReactNode
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const segment = useSelectedLayoutSegment()
  const base = `/dashboard/${businessId}/automations`
  const hrefOf = (part: Part) => (part === "overview" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item === segment) ?? "overview"
  const atOverview = part === "overview"
  // The business's own workspace works; Koblip's number needs none.
  const ownUsable = !!connection && !connection.needsReconnect
  const usable = ownUsable || sender === "koblip"
  const state = ownUsable ? connection.messages : null

  // While not every template is approved, opening the page makes any that
  // are missing in Chat and reads Meta's review; a new answer reloads.
  useEffect(() => {
    if (!ownUsable || state === "ready") return
    let current = true
    refreshChatMessages(businessId)
      .then((next) => {
        if (current && next !== state) router.refresh()
      })
      // Chat out of reach: the page keeps what it showed.
      .catch(() => null)
    return () => {
      current = false
    }
  }, [businessId, ownUsable, state, router])

  if (!usable) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">{m.shell.nav.automations}</h1>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircleIcon />
            </EmptyMedia>
            <EmptyTitle>{t.connectTitle}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/${businessId}/integrations`} />}
            >
              {connection ? m.integrations.koblipChat.reconnect : t.connect}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <SectionParts
      title={m.shell.nav.automations}
      parts={PARTS.map((item) => ({
        id: item,
        label: t.parts[item],
        href: hrefOf(item),
      }))}
      current={part}
      ariaLabel={t.partsLabel}
      notice={
        // Overview shows where the messages stand itself.
        state &&
        state !== "ready" &&
        !atOverview && (
          <p className="text-sm text-muted-foreground">
            {m.integrations.koblipChat.messages[state]}
          </p>
        )
      }
    >
      {children}
    </SectionParts>
  )
}
