"use client"

import { useState } from "react"
import Image from "next/image"
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  TargetIcon,
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
import { noAutofill } from "@/lib/no-autofill"
import { cn } from "@/lib/utils"
import { useOwnerMessages } from "../i18n/provider"

const CONNECT_FORM = "connect-whatsapp-form"

// The apps a business connects, as a settings list: each row is the app,
// what it does and its state. WhatsApp straight from Meta is coming; until
// then WhatsApp goes through Koblip Chat, which holds the Meta connection.
export function IntegrationsView({ connected }: { connected: boolean }) {
  const m = useOwnerMessages()
  const t = m.integrations
  const [connecting, setConnecting] = useState(false)

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
            description={t.koblipChat.description}
            action={
              connected ? (
                <Badge variant="secondary">{t.koblipChat.connected}</Badge>
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
          {/* Apple and Meta don't allow their logos without approval
              (Apple's marketing guidelines; meta.com/brand/resources/meta):
              a plain icon until it is given. */}
          <IntegrationRow
            logo={CalendarDaysIcon}
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
          {/* Stripe's wordmark from its logo kit (stripe.com/newsroom/
              brand-assets): blurple on light, white on dark. */}
          <IntegrationRow
            logo="/brands/stripe-wordmark-blurple.svg"
            logoDark="/brands/stripe-wordmark-white.svg"
            name={t.stripe.name}
            description={t.stripe.description}
            action={<Badge variant="secondary">{t.soon}</Badge>}
          />
        </ItemGroup>
      </PageSection>
      <PageSection id="tracking" title={t.tracking}>
        <ItemGroup className="gap-3">
          <IntegrationRow
            logo={TargetIcon}
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

      <ResponsivePanel
        open={connecting}
        onClose={() => setConnecting(false)}
        title={t.connect.title}
        footer={
          <Button type="submit" size="lg" form={CONNECT_FORM}>
            {t.connect.submit}
          </Button>
        }
      >
        {connecting && <ConnectForm />}
      </ResponsivePanel>
    </div>
  )
}

// An app's logo, shown whole (the "image" media is for photos and clips its
// corners): its file (with its dark-mode file, if it has one), or a plain
// icon on a tile where its logo can't be used.
type LogoProps = { logo: string | Icon; logoDark?: string; className: string }

function Logo({ logo, logoDark, className }: LogoProps) {
  if (typeof logo !== "string") {
    const LogoIcon = logo
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-muted text-muted-foreground",
          className
        )}
      >
        <LogoIcon className="size-1/2" />
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
      className={cn("object-contain", mode, className)}
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
  name,
  description,
  action,
}: {
  logo: string | Icon
  logoDark?: string
  name: string
  description: string
  action: React.ReactNode
}) {
  const t = useOwnerMessages().integrations
  return (
    <Item variant="outline">
      <ItemMedia>
        <Logo logo={logo} logoDark={logoDark} className="size-10" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        {/* ⓘ beside the name, where the row has room to spare. */}
        <ItemTitle className="max-w-full gap-1.5 overflow-visible">
          <span className="truncate">{name}</span>
          <DetailsButton
            title={name}
            text={description}
            media={<Logo logo={logo} logoDark={logoDark} className="size-16" />}
            label={t.about(name)}
          />
        </ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>{action}</ItemActions>
    </Item>
  )
}

function ConnectForm() {
  const t = useOwnerMessages().integrations.connect
  const [apiKey, setApiKey] = useState("")
  const [invalid, setInvalid] = useState(false)
  return (
    <form
      id={CONNECT_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!apiKey.trim()) setInvalid(true)
      }}
    >
      <FieldGroup>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="koblip-chat-key">{t.apiKey}</FieldLabel>
          <Input
            {...noAutofill("koblip_chat_key")}
            id="koblip-chat-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            enterKeyHint="done"
            aria-invalid={invalid || undefined}
          />
          {invalid ? (
            <FieldError>{t.apiKeyMissing}</FieldError>
          ) : (
            <FieldDescription>{t.apiKeyHint}</FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </form>
  )
}
