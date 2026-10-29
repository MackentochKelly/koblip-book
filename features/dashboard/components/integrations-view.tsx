"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronRightIcon } from "@/components/ui/icons"

import { PageSection } from "@/components/page-section"
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
            action={<Badge variant="secondary">{t.whatsapp.soon}</Badge>}
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

// One app: its logo shown whole (the "image" media is for photos and clips
// its corners), its name, what it does, and its state or action.
function IntegrationRow({
  logo,
  name,
  description,
  action,
}: {
  logo: string
  name: string
  description: string
  action: React.ReactNode
}) {
  return (
    <Item variant="outline">
      <ItemMedia>
        <Image
          src={logo}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="size-10 object-contain"
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
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
