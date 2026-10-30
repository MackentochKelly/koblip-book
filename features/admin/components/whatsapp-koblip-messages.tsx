"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { MessageCircleIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsappPreview } from "@/components/whatsapp-preview"
import type {
  KoblipLanguage,
  KoblipMessage,
  KoblipMessageName,
  KoblipReview,
  KoblipSubmitResult,
} from "@/types/koblip-messages"
import { useAdminMessages } from "../i18n/provider"
import { WHATSAPP_BASE } from "../utils/whatsapp-parts"

// The review a message shows in the list: the worse of its two languages.
function reviewOf(item: KoblipMessage): KoblipReview {
  const both = [item.texts.en.review, item.texts.es.review]
  for (const review of ["rejected", "draft", "waiting"] as const) {
    if (both.includes(review)) return review
  }
  return "approved"
}

// WhatsApp → Koblip messages (K2): Koblip's ready-made messages, the same for
// every business on Koblip's number. The admin reads each one in English and
// Spanish, then submits it to Meta from Koblip's own workspace.
export function WhatsappKoblipMessages({
  messages,
  connected,
  submit,
}: {
  messages: KoblipMessage[]
  // Koblip's own connection works (K1).
  connected: boolean
  // Passed in by the page (it lives with the Chat template code).
  submit: (message: KoblipMessageName, language: KoblipLanguage) => Promise<KoblipSubmitResult>
}) {
  const m = useAdminMessages().whatsapp
  const t = m.koblipMessages
  const [open, setOpen] = useState<KoblipMessageName | null>(null)

  if (!connected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleIcon />
          </EmptyMedia>
          <EmptyTitle>{t.notConnected}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href={`${WHATSAPP_BASE}/koblip-number`} />}>
            {t.openNumber}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <ItemGroup className="gap-3">
        {messages.map((item) => {
          const name = m.messages[item.message]
          const review = reviewOf(item)
          return (
            <Item key={item.message} variant="outline">
              <ItemContent className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpen(item.message)}
                  aria-label={t.open(name)}
                  className="flex min-h-11 items-center rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ItemTitle>{name}</ItemTitle>
                </button>
              </ItemContent>
              <ItemActions>
                <Badge variant={review === "rejected" ? "destructive" : "secondary"}>
                  {m.review[review]}
                </Badge>
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
      <MessagePanel
        // A fresh panel per message, so it opens in English each time.
        key={open ?? "none"}
        item={messages.find((item) => item.message === open) ?? null}
        submit={submit}
        onClose={() => setOpen(null)}
      />
    </>
  )
}

function MessagePanel({
  item,
  submit,
  onClose,
}: {
  item: KoblipMessage | null
  submit: (message: KoblipMessageName, language: KoblipLanguage) => Promise<KoblipSubmitResult>
  onClose: () => void
}) {
  const m = useAdminMessages().whatsapp
  const t = m.koblipMessages
  const router = useRouter()
  const [language, setLanguage] = useState<KoblipLanguage>("en")
  const [pending, startTransition] = useTransition()
  const text = item?.texts[language]
  // Only what Meta has nothing current of can be submitted.
  const submittable = text?.review === "draft" || text?.review === "rejected"

  function send() {
    if (!item) return
    startTransition(async () => {
      const result = await submit(item.message, language).catch(() => null)
      if (result?.ok) {
        router.refresh()
        toast.success(t.submitted)
      } else {
        toast.error(t.errors[result?.error ?? "not_found"])
      }
    })
  }

  return (
    <ResponsivePanel
      open={!!item}
      onClose={onClose}
      title={item ? t.open(m.messages[item.message]) : ""}
      footer={
        submittable && (
          <Button disabled={pending} onClick={send}>
            {pending && <Spinner data-icon="inline-start" />}
            {t.submit}
          </Button>
        )
      }
    >
      {item && text && (
        <FieldGroup>
          <Tabs value={language} onValueChange={(value) => setLanguage(value as KoblipLanguage)}>
            <TabsList className="w-full">
              <TabsTrigger value="en">{t.english}</TabsTrigger>
              <TabsTrigger value="es">{t.spanish}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t.meta}</span>
            <Badge variant={text.review === "rejected" ? "destructive" : "secondary"}>
              {m.review[text.review]}
            </Badge>
          </div>
          {text.review === "rejected" && text.reason && (
            <Alert variant="destructive">
              <AlertTitle>{t.metaReason}</AlertTitle>
              <AlertDescription>{text.reason}</AlertDescription>
            </Alert>
          )}

          <Field>
            <FieldLabel>{t.preview}</FieldLabel>
            <WhatsappPreview
              header={text.wording.header}
              body={text.preview}
              footer={text.wording.footer}
              buttons={text.buttons.map((button) => ({ key: button.action, label: button.label }))}
            />
            <FieldDescription>{t.hint}</FieldDescription>
          </Field>
        </FieldGroup>
      )}
    </ResponsivePanel>
  )
}
