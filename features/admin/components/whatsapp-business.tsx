"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { formatDuration } from "@/lib/format-duration"
import {
  resetBusinessSettings,
  resetBusinessWording,
  setBusinessMessageOn,
  turnOffBusinessWhatsapp,
} from "../api/whatsapp-business-actions"
import type { AdminMessages } from "../i18n"
import { useAdminMessages } from "../i18n/provider"

type Message = keyof AdminMessages["whatsapp"]["messages"]
type Review = keyof AdminMessages["whatsapp"]["review"]
type Language = "en" | "es"

// One business's WhatsApp as its page reads it (the page passes it in from
// the business's own WhatsApp code).
export type BusinessWhatsapp = {
  business: { id: string; name: string }
  connection: { workspaceName: string; needsReconnect: boolean } | null
  messages: {
    message: Message
    on: boolean
    texts: Record<Language, { isDefault: boolean; review: Review }>
  }[]
  settings: {
    ownerPhone: string | null
    reminders: number[]
    quietStart: string
    quietEnd: string
    freeTextInWindow: boolean
    cantCome: "cancel" | "alertOnly"
    thankYouReply: boolean
  }
}

const LANGUAGES: readonly Language[] = ["en", "es"]

type Ask =
  | { kind: "disconnect" }
  | { kind: "turnOff" }
  | { kind: "resetSettings" }
  | { kind: "resetWording"; message: Message }

// WhatsApp → Businesses → one business (A4): the number it sends from, each
// message on or off with its wording and Meta's review, and its settings.
// The admin turns messages on or off, resets wording or settings, turns
// every message off or disconnects its own number; each asks first.
export function WhatsappBusiness({
  data,
  disconnect,
}: {
  data: BusinessWhatsapp
  // Passed in by the page (it lives with the Chat connection code).
  disconnect: (businessId: string) => Promise<{ ok: boolean }>
}) {
  const m = useAdminMessages()
  const t = m.whatsapp.businesses
  const { business, connection, messages, settings } = data
  // What the dialog asks; kept while it closes, so its words stay.
  const [ask, setAskState] = useState<Ask | null>(null)
  const [asking, setAsking] = useState(false)
  const setAsk = (next: Ask) => {
    setAskState(next)
    setAsking(true)
  }
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      const done = await action().catch(() => null)
      if (done?.ok) toast.success(t.saved)
      else toast.error(t.failed)
    })
  }

  const allOff = messages.every((item) => !item.on)
  const onOff = (value: boolean) => (value ? t.on : t.off)
  const settingRows = [
    {
      label: t.reminders,
      value: settings.reminders.length
        ? settings.reminders.map(formatDuration).join(", ")
        : t.noReminders,
    },
    {
      label: t.quietHours,
      value: `${settings.quietStart}–${settings.quietEnd}`,
    },
    { label: t.freeText, value: onOff(settings.freeTextInWindow) },
    { label: t.cantCome, value: t.cantComeActions[settings.cantCome] },
    { label: t.thankYou, value: onOff(settings.thankYouReply) },
    { label: t.ownerPhone, value: settings.ownerPhone ?? t.noPhone },
  ]

  const dialog =
    ask?.kind === "disconnect"
      ? {
          title: t.disconnectTitle,
          description: t.disconnectText,
          confirm: t.disconnect,
          action: () => disconnect(business.id),
        }
      : ask?.kind === "turnOff"
        ? {
            title: t.turnOffTitle,
            description: t.turnOffText,
            confirm: t.turnOff,
            action: () => turnOffBusinessWhatsapp(business.id),
          }
        : ask?.kind === "resetSettings"
          ? {
              title: t.resetSettingsTitle,
              description: t.resetSettingsText,
              confirm: t.reset,
              action: () => resetBusinessSettings(business.id),
            }
          : ask?.kind === "resetWording"
            ? {
                title: t.resetWordingTitle(m.whatsapp.messages[ask.message]),
                description: t.resetWordingText,
                confirm: t.reset,
                action: () => resetBusinessWording(business.id, ask.message),
              }
            : null

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold tracking-tight">{business.name}</h2>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="business-connection"
      >
        <h3
          id="business-connection"
          className="text-lg font-semibold tracking-tight"
        >
          {t.connection}
        </h3>
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t.sender}</ItemTitle>
            <ItemDescription className="truncate">
              {connection
                ? t.ownNumber(connection.workspaceName)
                : t.koblipNumber}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {connection && (
              <>
                <Badge
                  variant={
                    connection.needsReconnect ? "destructive" : "secondary"
                  }
                >
                  {connection.needsReconnect ? t.reconnect : t.connected}
                </Badge>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setAsk({ kind: "disconnect" })}
                >
                  {t.disconnect}
                </Button>
              </>
            )}
          </ItemActions>
        </Item>
      </section>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="business-messages"
      >
        <h3
          id="business-messages"
          className="text-lg font-semibold tracking-tight"
        >
          {t.messagesTitle}
        </h3>
        <ItemGroup className="gap-3">
          {messages.map((item) => {
            const name = m.whatsapp.messages[item.message]
            const own = LANGUAGES.some(
              (language) => !item.texts[language].isDefault
            )
            return (
              <Item key={item.message} variant="outline" className="flex-wrap">
                <ItemContent className="min-w-0">
                  <ItemTitle>{name}</ItemTitle>
                  <ItemDescription>
                    {[
                      own ? t.ownWording : t.bookWording,
                      ...LANGUAGES.map(
                        (language) =>
                          `${language.toUpperCase()}: ${m.whatsapp.review[item.texts[language].review]}`
                      ),
                    ].join(" · ")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {own && (
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        setAsk({ kind: "resetWording", message: item.message })
                      }
                    >
                      {t.resetWording}
                    </Button>
                  )}
                  <Switch
                    checked={item.on}
                    disabled={pending}
                    aria-label={t.messageOn(name)}
                    onCheckedChange={(on) =>
                      run(() =>
                        setBusinessMessageOn(business.id, item.message, on)
                      )
                    }
                  />
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      </section>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="business-settings"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="business-settings"
            className="text-lg font-semibold tracking-tight"
          >
            {t.settingsTitle}
          </h3>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setAsk({ kind: "resetSettings" })}
          >
            {t.resetSettings}
          </Button>
        </div>
        <ItemGroup className="gap-3">
          {settingRows.map((row) => (
            <Item key={row.label} variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle>{row.label}</ItemTitle>
                <ItemDescription className="break-words">
                  {row.value}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </section>

      {!allOff && (
        <Button
          variant="destructive"
          className="w-full md:w-fit"
          disabled={pending}
          onClick={() => setAsk({ kind: "turnOff" })}
        >
          {t.turnOff}
        </Button>
      )}

      <ConfirmDialog
        open={asking}
        title={dialog?.title ?? ""}
        description={dialog?.description ?? ""}
        confirm={dialog?.confirm ?? ""}
        cancel={t.cancel}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          if (dialog) run(dialog.action)
        }}
      />
    </div>
  )
}
