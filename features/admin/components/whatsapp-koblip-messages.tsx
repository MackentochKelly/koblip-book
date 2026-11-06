"use client"

import { useState } from "react"
import Link from "next/link"
import { useMessages, useTranslations } from "next-intl"

import {
  MessageEditor,
  type EditorLimits,
  type EditorResult,
  type MessageEditorItem,
  type MessageEditorLabels,
} from "@/components/message-editor"
import { HelperLine } from "@/components/helper-line"
import { MessageStatus, type MessageStatusLabels } from "@/components/message-status"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { WhatsAppIcon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { fieldsFromLabels, fieldsToLabels, fillFields } from "@/lib/message-fields"
import type { ButtonAction } from "@/types/whatsapp"
import type {
  KoblipLanguage,
  KoblipMessage,
  KoblipMessageName,
  KoblipReview,
  KoblipSaveResult,
  KoblipSubmitResult,
} from "@/types/koblip-messages"
import { wordGroup } from "../utils/word-group"
import { WHATSAPP_BASE } from "../utils/whatsapp-parts"

type SaveError = Exclude<KoblipSaveResult, { ok: true }>["error"]
type SubmitError = Exclude<KoblipSubmitResult, { ok: true }>["error"]

// Meta's review of each message, in the admin's words.
function useReviewWords(): MessageStatusLabels["review"] {
  const t = useTranslations("admin.whatsapp")
  const words = useMessages().admin.whatsapp
  return wordGroup(words.review, (key) => t(`review.${key}`))
}

// The review a message shows in the list: the worse of its two languages.
function reviewOf(item: KoblipMessage): KoblipReview {
  const both = [item.texts.en.review, item.texts.es.review]
  for (const review of ["rejected", "draft", "waiting"] as const) {
    if (both.includes(review)) return review
  }
  return "approved"
}

// What the editor needs of one message, worked out by the page from Book's
// templates: its fields, the buttons it may take, and sample values.
export type KoblipEditorInfo = {
  fields: string[]
  buttonActions: ButtonAction[]
  examples: Record<KoblipLanguage, Record<string, string>>
}

// WhatsApp → Koblip messages (K2): Koblip's ready-made messages, the same for
// every business on Koblip's number. The admin edits each one in English and
// Spanish in the shared editor (docs/plans/message-editing.md, U3), then
// submits it to Meta from Koblip's own workspace.
export function WhatsappKoblipMessages({
  messages,
  connected,
  info,
  limits,
  save,
  submit,
}: {
  messages: KoblipMessage[]
  // Koblip's own connection works (K1).
  connected: boolean
  info: Record<KoblipMessageName, KoblipEditorInfo>
  limits: EditorLimits
  // Passed in by the page (they live with the Chat template code).
  save: (
    message: KoblipMessageName,
    language: KoblipLanguage,
    wording: { header: string; body: string; footer: string } | null,
    buttons: { action: ButtonAction; label: string }[] | null
  ) => Promise<KoblipSaveResult>
  submit: (message: KoblipMessageName, language: KoblipLanguage) => Promise<KoblipSubmitResult>
}) {
  const whatsapp = useTranslations("admin.whatsapp")
  const t = useTranslations("admin.whatsapp.koblipMessages")
  const review = useReviewWords()
  const [open, setOpen] = useState<KoblipMessageName | null>(null)
  const statusLabels: MessageStatusLabels = {
    normalMessage: t("normalMessage"),
    template: t("template"),
    sending: t("sending"),
    off: t("off"),
    review,
  }

  if (!connected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WhatsAppIcon />
          </EmptyMedia>
          <EmptyTitle>{t("notConnected")}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href={`${WHATSAPP_BASE}/koblip-number`} />}>
            {t("openNumber")}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <HelperLine more={t("more")} moreLabel={t("moreInfo")}>
        {t("hint")}
      </HelperLine>
      <ItemGroup className="gap-3">
        {messages.map((item) => {
          const name = whatsapp(`messages.${item.message}`)
          return (
            <Item key={item.message} variant="outline">
              <ItemContent className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpen(item.message)}
                  aria-label={t("open", { name: name.toLowerCase() })}
                  className="flex min-h-11 items-center rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ItemTitle>{name}</ItemTitle>
                </button>
                <div className="mt-2">
                  <MessageStatus review={reviewOf(item)} labels={statusLabels} />
                </div>
              </ItemContent>
            </Item>
          )
        })}
      </ItemGroup>
      <KoblipMessageEditor
        // A fresh editor per message, so it opens in English each time.
        key={open ?? "none"}
        item={messages.find((item) => item.message === open) ?? null}
        info={info}
        limits={limits}
        save={save}
        submit={submit}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}

// One of Koblip's messages in the shared editor, fields in the admin's words.
function KoblipMessageEditor({
  item,
  info,
  limits,
  save,
  submit,
  onClose,
}: {
  item: KoblipMessage | null
  info: Record<KoblipMessageName, KoblipEditorInfo>
  limits: EditorLimits
  save: Parameters<typeof WhatsappKoblipMessages>[0]["save"]
  submit: Parameters<typeof WhatsappKoblipMessages>[0]["submit"]
  onClose: () => void
}) {
  const whatsapp = useTranslations("admin.whatsapp")
  const t = useTranslations("admin.whatsapp.koblipMessages")
  const groups = useMessages().admin.whatsapp.koblipMessages
  const review = useReviewWords()
  const labels: Record<string, string> = wordGroup(groups.fields, (key) =>
    t(`fields.${key}`)
  )
  const about = item ? info[item.message] : null
  const words = (wording: { header: string; body: string; footer: string }) => ({
    ...wording,
    body: fieldsToLabels(wording.body, labels),
  })

  const editorItem: MessageEditorItem | null =
    item && about
      ? {
          name: whatsapp(`messages.${item.message}`),
          editable: true,
          fields: about.fields.map((field) => labels[field] ?? field),
          buttonActions: about.buttonActions,
          texts: {
            en: textOf(item, "en"),
            es: textOf(item, "es"),
          },
        }
      : null
  function textOf(message: KoblipMessage, language: KoblipLanguage) {
    const text = message.texts[language]
    return {
      wording: words(text.wording),
      buttons: text.buttons,
      isDefault: text.isDefault,
      review: text.review,
      reason: text.reason,
      approved: text.approved && { wording: words(text.approved.wording), buttons: text.approved.buttons },
    }
  }
  const saveProblem = (error: SaveError) => t(`problems.${error}`)
  const submitProblem = (error: SubmitError) => t(`errors.${error}`)
  const editorLabels: MessageEditorLabels = {
    // "Edit booking confirmed".
    edit: (name) => t("edit", { name: name.toLowerCase() }),
    english: t("english"),
    spanish: t("spanish"),
    metaReason: t("metaReason"),
    review,
    readOnly: t("hint"),
    title: t("title"),
    text: t("text"),
    footer: t("footer"),
    buttons: t("buttons"),
    buttonKinds: wordGroup(groups.buttonKinds, (key) => t(`buttonKinds.${key}`)),
    addButton: t("addButton"),
    removeButton: (label) => t("removeButton", { label }),
    normalMessage: t("normalMessage"),
    normalHint: t("normalHint"),
    sending: t("sending"),
    template: t("template"),
    templateHint: t("templateHint"),
    approvedNow: t("approvedNow"),
    reset: t("reset"),
    save: t("save"),
    submit: t("submit"),
    saved: t("saved"),
    submitted: t("submitted"),
    failed: t("failed"),
  }

  return (
    <MessageEditor
      item={editorItem}
      labels={editorLabels}
      limits={limits}
      preview={(body, language) =>
        fillFields(fieldsFromLabels(body, labels), about?.examples[language] ?? {})
      }
      onSave={async (language, draft): Promise<EditorResult> => {
        if (!item) return { ok: false, problem: null }
        const result = await save(
          item.message,
          language,
          draft && { ...draft.wording, body: fieldsFromLabels(draft.wording.body, labels) },
          draft && draft.buttons
        )
        return result.ok ? result : { ok: false, problem: saveProblem(result.error) }
      }}
      onSubmit={async (language): Promise<EditorResult> => {
        if (!item) return { ok: false, problem: null }
        const result = await submit(item.message, language)
        if (result.ok) return result
        // Meta refused: its own words when Chat passed them on.
        return {
          ok: false,
          problem: result.error === "chat" && result.reason ? result.reason : submitProblem(result.error),
        }
      }}
      onClose={onClose}
    />
  )
}
