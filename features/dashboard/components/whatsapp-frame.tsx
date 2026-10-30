"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter, useSelectedLayoutSegment } from "next/navigation"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CornerLeftUpIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  PhoneIcon,
} from "@/components/ui/icons"

import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { refreshChatMessages } from "../api/chat-connection"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type { Sender } from "../types/notifications"

// The page's parts, in order. Overview is the page itself; each other part
// is its own route below it (app/(owner)/dashboard/[businessId]/whatsapp/).
const PARTS = [
  { id: "overview", icon: LayoutDashboardIcon },
  { id: "messages", icon: MessageCircleIcon },
  { id: "alerts", icon: PhoneIcon },
  { id: "timing", icon: ClockIcon },
  { id: "replies", icon: CornerLeftUpIcon },
  { id: "activity", icon: CalendarDaysIcon },
] as const

type Part = (typeof PARTS)[number]["id"]

// The WhatsApp page's frame around its parts. On a computer: the title and
// a row of tabs. On a phone: the Overview with a list of the other parts
// under it; each part opens as its own screen with a way back. A business
// without its own Koblip Chat workspace sends from Koblip's number (K4).
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
  const base = `/dashboard/${businessId}/whatsapp`
  const hrefOf = (part: Part) => (part === "overview" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item.id === segment)?.id ?? "overview"
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
        <h1 className="text-2xl font-semibold tracking-tight">{m.shell.nav.whatsapp}</h1>
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {!atOverview && (
          <Button
            variant="ghost"
            className="-ml-2.5 w-fit md:hidden"
            nativeButton={false}
            render={<Link href={base} />}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            {m.shell.nav.whatsapp}
          </Button>
        )}
        {/* A phone shows the open part's name; a computer, the page's. */}
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className={atOverview ? undefined : "max-md:hidden"}>
            {m.shell.nav.whatsapp}
          </span>
          {!atOverview && <span className="md:hidden">{t.parts[part]}</span>}
        </h1>
        {/* Overview shows where the messages stand itself. */}
        {state && state !== "ready" && !atOverview && (
          <p className="text-sm text-muted-foreground">
            {m.integrations.koblipChat.messages[state]}
          </p>
        )}
      </div>

      <ViewTabs
        variant="line"
        className="max-md:hidden"
        ariaLabel={t.partsLabel}
        views={PARTS.map((item) => ({ id: item.id, label: t.parts[item.id] }))}
        value={part}
        onChange={(next) => router.push(hrefOf(next))}
      />

      {children}

      {atOverview && (
        <nav aria-label={t.partsLabel} className="md:hidden">
          <ItemGroup className="gap-3">
            {PARTS.filter((item) => item.id !== "overview").map((item) => (
              <Item
                key={item.id}
                variant="outline"
                render={<Link href={hrefOf(item.id)} />}
              >
                <ItemMedia variant="icon">
                  <item.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t.parts[item.id]}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </nav>
      )}
    </div>
  )
}
