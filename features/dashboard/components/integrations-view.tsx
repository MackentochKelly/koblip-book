"use client"

import { Fragment, useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ChevronRightIcon,
  MailIcon,
  type Icon,
} from "@/components/ui/icons"

import { PageSection } from "@/components/page-section"
import { DetailsButton } from "@/components/details-button"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { disconnectChat, refreshChatMessages } from "../api/chat-connection"
import { disconnectGoogleCalendar } from "../api/google-calendar-actions"
import { useConnectWindow } from "../hooks/use-connect-window"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type { GoogleCalendarConnection } from "../types/google-calendar"
import type { Sender } from "@/types/whatsapp"
import {
  CHAT_CONNECT_CHANNEL,
  type ChatConnectMessage,
  type ChatConnectResult,
} from "@/types/chat-connect"
import {
  GOOGLE_CONNECT_CHANNEL,
  type GoogleConnectMessage,
  type GoogleConnectResult,
} from "@/types/google-calendar-connect"
import { ConfirmRemove } from "./confirm-remove"
import { GoogleCalendarPanel } from "./google-calendar-panel"
import { RemoveGoogleEvents } from "./remove-google-events"
import { WhatsappPanel } from "./whatsapp-panel"

// The apps a business connects, as a settings list: each row is the app,
// what it does and its state. WhatsApp straight from Meta is coming; until
// then WhatsApp goes through Koblip Chat, which holds the Meta connection.
export function IntegrationsView({
  businessId,
  connection,
  sender,
  result,
  googleCalendar,
  googleResult,
  team,
}: {
  businessId: string
  connection: ChatConnection | null
  // Which number sends WhatsApp messages (senderFor), or none.
  sender: Sender | null
  // How a Chat window opened as a full page ended (?chat=), shown once.
  result: ChatConnectResult | null
  googleCalendar: GoogleCalendarConnection | null
  // The same for Google's window (?google=).
  googleResult: GoogleConnectResult | null
  // The team, for whose bookings Google busy times block.
  team: { id: string; name: string }[]
}) {
  const m = useOwnerMessages()
  const t = m.integrations
  const router = useRouter()
  const chatWindow = useConnectWindow()
  const googleWindow = useConnectWindow()
  const [disconnecting, setDisconnecting] = useState<"chat" | "google" | null>(null)
  const [view, setView] = useState<"connected" | "all">("connected")
  const [managingGoogle, setManagingGoogle] = useState(false)
  const [managingWhatsapp, setManagingWhatsapp] = useState(false)
  const [removeGoogleEvents, setRemoveGoogleEvents] = useState(false)
  const setChatWaiting = chatWindow.setWaiting
  const setGoogleWaiting = googleWindow.setWaiting

  // The Chat window says how it ended on a same-site channel: the page
  // shows the saved connection, or says it failed. Cancel says nothing.
  useEffect(() => {
    function ended(next: ChatConnectResult) {
      setChatWaiting(false)
      if (next === "connected") {
        router.refresh()
        toast(t.koblipChat.connectedToast)
      } else if (next === "failed") {
        toast.error(t.koblipChat.failed)
      }
    }
    if (result) {
      ended(result)
      router.replace(`/dashboard/${encodeURIComponent(businessId)}/integrations`)
    }
    const channel = new BroadcastChannel(CHAT_CONNECT_CHANNEL)
    channel.onmessage = (event: MessageEvent<ChatConnectMessage>) => {
      if (!event.data?.koblip && event.data?.businessId === businessId) ended(event.data.result)
    }
    return () => channel.close()
  }, [businessId, result, router, t, setChatWaiting])

  // Google's window, the same way; cancelling (or leaving out the calendar)
  // says how to connect.
  useEffect(() => {
    function ended(next: GoogleConnectResult) {
      setGoogleWaiting(false)
      if (next === "connected") {
        router.refresh()
        toast(t.googleCalendar.connectedToast)
      } else {
        toast.error(next === "denied" ? t.googleCalendar.denied : t.googleCalendar.failed)
      }
    }
    if (googleResult) {
      ended(googleResult)
      router.replace(`/dashboard/${encodeURIComponent(businessId)}/integrations`)
    }
    const channel = new BroadcastChannel(GOOGLE_CONNECT_CHANNEL)
    channel.onmessage = (event: MessageEvent<GoogleConnectMessage>) => {
      if (event.data?.businessId === businessId) ended(event.data.result)
    }
    return () => channel.close()
  }, [businessId, googleResult, router, t, setGoogleWaiting])

  // While connected and not yet ready, opening this page makes any missing
  // booking templates in Chat and reads Meta's review; a new answer reloads.
  const usable = !!connection && !connection.needsReconnect
  const messages = connection?.messages ?? null
  useEffect(() => {
    if (!usable || messages === "ready") return
    let current = true
    refreshChatMessages(businessId).then((next) => {
      if (current && next !== messages) router.refresh()
    })
    return () => {
      current = false
    }
  }, [businessId, usable, messages, router])

  const query = `businessId=${encodeURIComponent(businessId)}`
  const waiting = chatWindow.waiting
  // Koblip Chat's window, from its row or WhatsApp's "Use your own number".
  const connectChat = () =>
    chatWindow.openWindow(`/api/chat/connect?${query}`, "koblip-chat-connect")
  const googleUsable = !!googleCalendar && !googleCalendar.needsReconnect

  // The same rows show on both tabs.
  // Koblip Chat's app icon, from its own app.
  const chatRow = (
    <IntegrationRow
      logo="/brands/koblip-chat.png"
      name={t.koblipChat.name}
      description={
        !connection
          ? t.koblipChat.description
          : connection.needsReconnect
            ? t.koblipChat.reconnectHint
            : connection.messages === "ready"
              ? t.koblipChat.workspace(connection.workspaceName)
              : t.koblipChat.messages[connection.messages]
      }
      action={
        connection && !connection.needsReconnect ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t.koblipChat.connected}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManagingWhatsapp(true)}
            >
              {t.koblipChat.manage}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={connectChat}
            disabled={waiting}
          >
            {waiting && <Spinner data-icon="inline-start" />}
            {connection ? t.koblipChat.reconnect : t.koblipChat.connect}
            {!waiting && <ChevronRightIcon data-icon="inline-end" />}
          </Button>
        )
      }
    />
  )
  // Google's own Calendar logo (2026), unaltered, from the Google Workspace
  // branding pack, only to name the app.
  const googleRow = (
    <IntegrationRow
      logo="/brands/google-calendar.png"
      name={t.googleCalendar.name}
      description={
        !googleCalendar
          ? t.googleCalendar.description
          : googleCalendar.needsReconnect
            ? t.googleCalendar.reconnectHint
            : googleCalendar.syncFailed
              ? t.googleCalendar.syncFailed
              : t.googleCalendar.account(googleCalendar.googleEmail)
      }
      action={
        googleUsable ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t.googleCalendar.connected}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManagingGoogle(true)}
            >
              {t.googleCalendar.manage}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              googleWindow.openWindow(
                `/api/google-calendar/connect?${query}`,
                "koblip-google-calendar-connect"
              )
            }
            disabled={googleWindow.waiting}
          >
            {googleWindow.waiting && <Spinner data-icon="inline-start" />}
            {googleCalendar ? t.googleCalendar.reconnect : t.googleCalendar.connect}
            {!googleWindow.waiting && <ChevronRightIcon data-icon="inline-end" />}
          </Button>
        )
      }
    />
  )
  // WhatsApp works as soon as a number sends: Koblip's by default, or the
  // business's own; the same words as the WhatsApp page.
  const whatsappRow = sender && (
    <IntegrationRow
      logo="/brands/whatsapp-glyph-green.svg"
      name={t.whatsapp.name}
      description={m.whatsapp.sendingFrom[sender]}
      action={
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t.whatsapp.connected}</Badge>
          <Button variant="outline" size="sm" onClick={() => setManagingWhatsapp(true)}>
            {t.whatsapp.manage}
          </Button>
        </div>
      }
    />
  )
  // Connected: the apps working for the business now.
  const connectedRows = [
    whatsappRow && <Fragment key="whatsapp">{whatsappRow}</Fragment>,
    usable && <Fragment key="chat">{chatRow}</Fragment>,
    googleUsable && <Fragment key="google">{googleRow}</Fragment>,
  ].filter(Boolean)
  // Suggested: the apps that work today and aren't connected yet, Google
  // Calendar first. "Coming soon" apps are never suggested.
  const suggestedRows = [
    !googleUsable && <Fragment key="google">{googleRow}</Fragment>,
    !usable && <Fragment key="chat">{chatRow}</Fragment>,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
        {m.shell.nav.integrations}
      </h1>
      <ViewTabs
        views={[
          { id: "connected" as const, label: t.tabs.connected },
          { id: "all" as const, label: t.tabs.all },
        ]}
        value={view}
        onChange={setView}
        ariaLabel={t.tabs.label}
        listClassName="w-full md:w-fit"
      />

      {view === "connected" ? (
        <>
          {connectedRows.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t.noneConnected}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">{connectedRows}</ItemGroup>
          )}
          {suggestedRows.length > 0 && (
            <PageSection id="suggested" title={t.suggested}>
              <ItemGroup className="gap-3">{suggestedRows}</ItemGroup>
            </PageSection>
          )}
        </>
      ) : (
        <>
          <PageSection id="messaging" title={t.messaging}>
            <ItemGroup className="gap-3">
              {/* WhatsApp's own file from the official pack, never recoloured
                  (meta.com/brand/resources/whatsapp/whatsapp-brand). */}
              <IntegrationRow
                logo="/brands/whatsapp-glyph-green.svg"
                name={t.whatsapp.name}
                description={t.whatsapp.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
              {chatRow}
              {/* Texts go through Twilio: its own app icon, as twilio.com uses
                  it; a square, so its corners are rounded. */}
              <IntegrationRow
                logo="/brands/twilio.png"
                square
                name={t.sms.name}
                description={t.sms.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
              {/* Email has no brand: an app-style tile. */}
              <IntegrationRow
                logo={MailIcon}
                name={t.email.name}
                description={t.email.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
            </ItemGroup>
          </PageSection>
          <PageSection id="social" title={t.social}>
            <ItemGroup className="gap-3">
              {/* Instagram's and Facebook's own icons, from their own sites. */}
              <IntegrationRow
                logo="/brands/instagram.png"
                name={t.instagram.name}
                description={t.instagram.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
              <IntegrationRow
                logo="/brands/facebook.png"
                name={t.facebook.name}
                description={t.facebook.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
              {/* Google's own Business Profile icon, from Google's servers. */}
              <IntegrationRow
                logo="/brands/google-business.png"
                name={t.googleBusiness.name}
                description={t.googleBusiness.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
            </ItemGroup>
          </PageSection>
          <PageSection id="calendar" title={t.calendar}>
            <ItemGroup className="gap-3">
              {googleRow}
              {/* Apple's own Calendar app icon, unaltered. */}
              <IntegrationRow
                logo="/brands/apple-calendar.png"
                name={t.appleCalendar.name}
                description={t.appleCalendar.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
              {/* Outlook's icon from Microsoft's own Office web server. */}
              <IntegrationRow
                logo="/brands/outlook.svg"
                name={t.outlook.name}
                description={t.outlook.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
            </ItemGroup>
          </PageSection>
          <PageSection id="payments" title={t.payments}>
            <ItemGroup className="gap-3">
              {/* Stripe's own app icon, as stripe.com uses it; a square, so
                  its corners are rounded like the other app icons. */}
              <IntegrationRow
                logo="/brands/stripe.svg"
                square
                name={t.stripe.name}
                description={t.stripe.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
            </ItemGroup>
          </PageSection>
          <PageSection id="reviews" title={t.reviews}>
            <ItemGroup className="gap-3">
              {/* Google's own "G", colour on light and its dark-mode file. */}
              <IntegrationRow
                logo="/brands/google-g-light.png"
                logoDark="/brands/google-g-dark.png"
                name={t.googleReviews.name}
                description={t.googleReviews.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
            </ItemGroup>
          </PageSection>
          <PageSection id="tracking" title={t.tracking}>
            <ItemGroup className="gap-3">
              {/* Meta's symbol, from the logo in its brand pack: colour on
                  light, white on dark. */}
              <IntegrationRow
                logo="/brands/meta-symbol.png"
                logoDark="/brands/meta-symbol-white.png"
                name={t.metaPixel.name}
                description={t.metaPixel.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
              {/* Google's own Analytics icon, from Google's servers. */}
              <IntegrationRow
                logo="/brands/google-analytics.svg"
                name={t.googleAnalytics.name}
                description={t.googleAnalytics.description}
                action={<Badge variant="secondary">{t.soon}</Badge>}
              />
            </ItemGroup>
          </PageSection>
        </>
      )}

      {/* Koblip Chat holds the business's own WhatsApp number, so its
          Manage opens the same panel as WhatsApp's. */}
      {(sender || usable) && (
        <WhatsappPanel
          open={managingWhatsapp}
          onClose={() => setManagingWhatsapp(false)}
          sender={sender}
          connection={connection}
          connecting={waiting}
          onConnect={connectChat}
          onDisconnect={() => {
            setManagingWhatsapp(false)
            setDisconnecting("chat")
          }}
        />
      )}
      {googleCalendar && (
        <GoogleCalendarPanel
          open={managingGoogle && googleUsable}
          onClose={() => setManagingGoogle(false)}
          businessId={businessId}
          connection={googleCalendar}
          team={team}
          onDisconnect={() => {
            setManagingGoogle(false)
            setRemoveGoogleEvents(false)
            setDisconnecting("google")
          }}
        />
      )}
      <ConfirmRemove
        name={
          disconnecting === "chat"
            ? t.koblipChat.name
            : disconnecting === "google"
              ? t.googleCalendar.name
              : null
        }
        onClose={() => setDisconnecting(null)}
        onConfirm={async () => {
          if (disconnecting === "google") {
            const result = await disconnectGoogleCalendar(businessId, removeGoogleEvents)
            if (result.eventsRemoved) toast(t.googleCalendar.disconnected)
            else toast.error(t.googleCalendar.removeEventsFailed)
          } else {
            await disconnectChat(businessId)
            toast(t.koblipChat.disconnected)
          }
          router.refresh()
        }}
      >
        {disconnecting === "google" && (
          <RemoveGoogleEvents checked={removeGoogleEvents} onCheckedChange={setRemoveGoogleEvents} />
        )}
      </ConfirmRemove>
    </div>
  )
}

// An app's logo, shown whole (the "image" media is for photos and clips its
// corners), with its dark-mode file if it has one. A `square` icon gets
// app-icon corners. A service with no brand gets its icon on a tile.
type LogoProps = {
  logo: string | Icon
  logoDark?: string
  square?: boolean
  className: string
}

function Logo({ logo, logoDark, square, className }: LogoProps) {
  if (typeof logo !== "string") {
    const Glyph = logo
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-muted text-muted-foreground",
          className
        )}
      >
        <Glyph className="size-1/2" />
      </span>
    )
  }
  const image = (src: string, mode?: string) => (
    <Image
      src={src}
      alt=""
      width={64}
      height={64}
      unoptimized
      className={cn("object-contain", square && "rounded-xl", mode, className)}
    />
  )
  if (!logoDark) return image(logo)
  return (
    <>
      {image(logo, "dark:hidden")}
      {image(logoDark, "hidden dark:block")}
    </>
  )
}

// One app: its logo, its name with ⓘ (the whole text), what it does in two
// lines, and its state or action.
function IntegrationRow({
  logo,
  logoDark,
  square,
  name,
  description,
  action,
}: {
  logo: string | Icon
  logoDark?: string
  square?: boolean
  name: string
  description: string
  action: React.ReactNode
}) {
  const t = useOwnerMessages().integrations
  return (
    <Item variant="outline">
      <ItemMedia>
        <Logo logo={logo} logoDark={logoDark} square={square} className="size-10" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        {/* ⓘ beside the name, where the row has room to spare. */}
        <ItemTitle className="max-w-full gap-1.5 overflow-visible">
          <span className="truncate">{name}</span>
          <DetailsButton
            title={name}
            text={description}
            media={<Logo logo={logo} logoDark={logoDark} square={square} className="size-16" />}
            label={t.about(name)}
          />
        </ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>{action}</ItemActions>
    </Item>
  )
}
