"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ChevronRightIcon,
  MailIcon,
  type Icon,
} from "@/components/ui/icons"

import { PageSection } from "@/components/page-section"
import { DetailsButton } from "@/components/details-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { disconnectChat } from "../api/chat-connection"
import { useOwnerMessages } from "../i18n/provider"
import {
  CHAT_CONNECT_CHANNEL,
  type ChatConnection,
  type ChatConnectResult,
} from "../types/chat-connection"
import { ConfirmRemove } from "./confirm-remove"

// The apps a business connects, as a settings list: each row is the app,
// what it does and its state. WhatsApp straight from Meta is coming; until
// then WhatsApp goes through Koblip Chat, which holds the Meta connection.
export function IntegrationsView({
  businessId,
  connection,
  result,
}: {
  businessId: string
  connection: ChatConnection | null
  // How a Chat window opened as a full page ended (?chat=), shown once.
  result: ChatConnectResult | null
}) {
  const m = useOwnerMessages()
  const t = m.integrations
  const router = useRouter()
  const [waiting, setWaiting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // The Chat window says how it ended on a same-site channel: the page
  // shows the saved connection, or says it failed. Cancel says nothing.
  useEffect(() => {
    function ended(next: ChatConnectResult) {
      setWaiting(false)
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
    channel.onmessage = (event: MessageEvent<{ businessId: string; result: ChatConnectResult }>) => {
      if (event.data?.businessId === businessId) ended(event.data.result)
    }
    return () => channel.close()
  }, [businessId, result, router, t])

  // Koblip Chat's consent page in its own small window (OAuth popup); a
  // blocked window opens it in this tab instead.
  function connect() {
    const url = `/api/chat/connect?businessId=${encodeURIComponent(businessId)}`
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {m.shell.nav.integrations}
      </h1>
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
          {/* Koblip Chat's app icon, from its own app. */}
          <IntegrationRow
            logo="/brands/koblip-chat.png"
            name={t.koblipChat.name}
            description={
              !connection
                ? t.koblipChat.description
                : connection.needsReconnect
                  ? t.koblipChat.reconnectHint
                  : t.koblipChat.workspace(connection.workspaceName)
            }
            action={
              connection && !connection.needsReconnect ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t.koblipChat.connected}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisconnecting(true)}
                  >
                    {t.koblipChat.disconnect}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connect}
                  disabled={waiting}
                >
                  {waiting && <Spinner data-icon="inline-start" />}
                  {connection ? t.koblipChat.reconnect : t.koblipChat.connect}
                  {!waiting && <ChevronRightIcon data-icon="inline-end" />}
                </Button>
              )
            }
          />
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
          {/* Google's own Calendar logo (2026), unaltered, from the
              Google Workspace branding pack, only to name the app. */}
          <IntegrationRow
            logo="/brands/google-calendar.png"
            name={t.googleCalendar.name}
            description={t.googleCalendar.description}
            action={<Badge variant="secondary">{t.soon}</Badge>}
          />
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

      <ConfirmRemove
        name={disconnecting ? t.koblipChat.name : null}
        onClose={() => setDisconnecting(false)}
        onConfirm={async () => {
          await disconnectChat(businessId)
          router.refresh()
          toast(t.koblipChat.disconnected)
        }}
      />
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
