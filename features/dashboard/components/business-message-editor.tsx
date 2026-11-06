"use client"

import { type Messages, useTranslations } from "next-intl"

import {
  MessageEditor,
  type EditorLimits,
  type MessageEditorItem,
} from "@/components/message-editor"
import { fillFields } from "@/lib/message-fields"
import { saveMessageWording, submitMessageToMeta } from "../api/notification-actions"
import type { NotificationMessage } from "../types/notifications"
import {
  TEMPLATE_LANGUAGES,
  type BookingField,
  type TemplateLanguage,
  fieldsForOwner,
  fieldsFromOwner,
  messageButtonActions,
  messageFields,
} from "../utils/booking-templates"

type Problem = keyof Messages["owner"]["whatsapp"]["problems"]

// A business's own message in the shared editor: its wording with fields in
// the owner's words, saved and submitted from its own Koblip Chat. On
// Koblip's number the message is read-only (`editable`).
export function BusinessMessageEditor({
  businessId,
  item,
  limits,
  examples,
  onClose,
}: {
  businessId: string
  item: NotificationMessage | null
  limits: EditorLimits
  // Each language's sample values, for the preview (message-words.ts).
  examples: Record<TemplateLanguage, Record<BookingField, string>>
  onClose: () => void
}) {
  const t = useTranslations("owner.whatsapp")
  // Every field a message may use, as the owner reads them.
  const fields: Record<BookingField, string> = {
    name: t("fields.name"),
    service: t("fields.service"),
    business: t("fields.business"),
    date: t("fields.date"),
    time: t("fields.time"),
    teamMember: t("fields.teamMember"),
    duration: t("fields.duration"),
    price: t("fields.price"),
    address: t("fields.address"),
    phone: t("fields.phone"),
  }
  // A code the server sent, in words when there are some for it.
  const problemOf = (error: string) => {
    const key = `problems.${error}` as `problems.${Problem}`
    return t.has(key) ? t(key) : t("failed")
  }

  const editorItem: MessageEditorItem | null = item && {
    name: t(`names.${item.message}`),
    editable: item.editable,
    fields: messageFields(item.message).map((field) => fields[field]),
    buttonActions: messageButtonActions(item.message),
    texts: Object.fromEntries(
      TEMPLATE_LANGUAGES.map((language) => {
        const { approved, ...text } = item.texts[language]
        return [
          language,
          {
            ...text,
            wording: { ...text.wording, body: fieldsForOwner(text.wording.body, fields) },
            // The words Meta approved, in the owner's words like the rest.
            approved: approved && {
              wording: { ...approved.wording, body: fieldsForOwner(approved.wording.body, fields) },
              buttons: approved.buttons,
            },
          },
        ]
      })
    ) as MessageEditorItem["texts"],
  }

  return (
    <MessageEditor
      item={editorItem}
      labels={{
        edit: (name) => t("edit", { name: name.toLowerCase() }),
        language: t("language"),
        metaReason: t("metaReason"),
        review: {
          missing: t("review.missing"),
          draft: t("review.draft"),
          waiting: t("review.waiting"),
          approved: t("review.approved"),
          rejected: t("review.rejected"),
        },
        readOnly: t("koblipWording"),
        title: t("title"),
        text: t("text"),
        footer: t("footer"),
        buttons: t("buttons"),
        buttonKinds: {
          confirm: t("buttonKinds.confirm"),
          cantCome: t("buttonKinds.cantCome"),
          ok: t("buttonKinds.ok"),
        },
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
      }}
      limits={limits}
      preview={(body, language) => fillFields(fieldsFromOwner(body, fields), examples[language])}
      onSave={async (language, draft) => {
        if (!item) return { ok: false, problem: null }
        const result = await saveMessageWording(
          businessId,
          item.message,
          language,
          draft && { ...draft.wording, body: fieldsFromOwner(draft.wording.body, fields) },
          draft && draft.buttons
        )
        return result.ok ? result : { ok: false, problem: problemOf(result.error) }
      }}
      onSubmit={async (language) => {
        if (!item) return { ok: false, problem: null }
        const result = await submitMessageToMeta(businessId, item.message, language)
        if (result.ok) return result
        // Meta refused at once: its own words.
        return { ok: false, problem: "reason" in result ? result.reason : problemOf(result.error) }
      }}
      onClose={onClose}
    />
  )
}
