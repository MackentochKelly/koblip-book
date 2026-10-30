"use client"

import { useState } from "react"
import Image from "next/image"
import {
  ChevronRightIcon,
  MailIcon,
  type Icon,
} from "@/components/ui/icons"

import { PageSection } from "@/components/page-section"
import { DetailsButton } from "@/components/details-button"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { noAutofill } from "@/lib/no-autofill"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { connectChat, disconnectChat } from "../api/chat-connection"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection, ConnectChatFailure } from "../types/chat-connection"
import { ConfirmRemove } from "./confirm-remove"

const CONNECT_FORM = "connect-whatsapp-form"

// The apps a business connects, as a settings list: each row is the app,
// what it does and its state. WhatsApp straight from Meta is coming; until
// then WhatsApp goes through Koblip Chat, which holds the Meta connection.
export function IntegrationsView({
  businessId,
  connection: saved,
}: {
  businessId: string
  connection: ChatConnection | null
}) {
  const m = useOwnerMessages()
  const t = m.integrations
  const [connection, setConnection] = useState(saved)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

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
              connection
                ? t.koblipChat.key(connection.last4)
                : t.koblipChat.description
            }
            action={
              connection ? (
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
                  onClick={() => setConnecting(true)}
                >
                  {t.koblipChat.connect}
                  <ChevronRightIcon data-icon="inline-end" />
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

      <ConnectPanel
        open={connecting}
        businessId={businessId}
        onClose={() => setConnecting(false)}
        onConnected={(next) => {
          setConnection(next)
          setConnecting(false)
        }}
      />
      <ConfirmRemove
        name={disconnecting ? t.koblipChat.name : null}
        onClose={() => setDisconnecting(false)}
        onConfirm={async () => {
          await disconnectChat(businessId)
          setConnection(null)
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

function ConnectPanel({
  open,
  businessId,
  onClose,
  onConnected,
}: {
  open: boolean
  businessId: string
  onClose: () => void
  onConnected: (connection: ChatConnection) => void
}) {
  const t = useOwnerMessages().integrations.connect
  const [apiKey, setApiKey] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [missing, setMissing] = useState({ apiKey: false, workspaceId: false })
  const [failure, setFailure] = useState<ConnectChatFailure | null>(null)
  const [pending, setPending] = useState(false)

  function close() {
    setApiKey("")
    setWorkspaceId("")
    setMissing({ apiKey: false, workspaceId: false })
    setFailure(null)
    onClose()
  }

  async function submit() {
    const next = {
      apiKey: !apiKey.trim(),
      workspaceId: !workspaceId.trim(),
    }
    setMissing(next)
    setFailure(null)
    if (next.apiKey || next.workspaceId) return
    setPending(true)
    try {
      const result = await connectChat(businessId, {
        apiKey: apiKey.trim(),
        workspaceId: workspaceId.trim(),
      })
      if (result.ok) {
        onConnected(result.connection)
        close()
      } else {
        setFailure(result.reason)
      }
    } catch {
      setFailure("unreachable")
    } finally {
      setPending(false)
    }
  }

  return (
    <ResponsivePanel
      open={open}
      onClose={close}
      title={t.title}
      footer={
        <Button type="submit" size="lg" form={CONNECT_FORM} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {t.submit}
        </Button>
      }
    >
      <form
        id={CONNECT_FORM}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <FieldGroup>
          <Field
            data-invalid={
              missing.apiKey || failure === "invalid_key" || undefined
            }
          >
            <FieldLabel htmlFor="koblip-chat-key">{t.apiKey}</FieldLabel>
            <Input
              {...noAutofill("koblip_chat_key")}
              id="koblip-chat-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              enterKeyHint="next"
              aria-invalid={
                missing.apiKey || failure === "invalid_key" || undefined
              }
            />
            {missing.apiKey ? (
              <FieldError>{t.apiKeyMissing}</FieldError>
            ) : failure === "invalid_key" ? (
              <FieldError>{t.errors.invalid_key}</FieldError>
            ) : (
              <FieldDescription>{t.apiKeyHint}</FieldDescription>
            )}
          </Field>
          <Field
            data-invalid={
              missing.workspaceId || failure === "wrong_workspace" || undefined
            }
          >
            <FieldLabel htmlFor="koblip-chat-workspace">
              {t.workspaceId}
            </FieldLabel>
            <Input
              {...noAutofill("koblip_chat_workspace")}
              id="koblip-chat-workspace"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              enterKeyHint="done"
              aria-invalid={
                missing.workspaceId || failure === "wrong_workspace" || undefined
              }
            />
            {missing.workspaceId ? (
              <FieldError>{t.workspaceIdMissing}</FieldError>
            ) : failure === "wrong_workspace" ? (
              <FieldError>{t.errors.wrong_workspace}</FieldError>
            ) : (
              <FieldDescription>{t.workspaceIdHint}</FieldDescription>
            )}
          </Field>
          {(failure === "no_permission" || failure === "unreachable") && (
            <FieldError>{t.errors[failure]}</FieldError>
          )}
        </FieldGroup>
      </form>
    </ResponsivePanel>
  )
}
