"use client"

import {
  MessageEditor,
  type EditorLimits,
  type MessageEditorItem,
} from "@/components/message-editor"
import { saveMessageWording, submitMessageToMeta } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { NotificationMessage } from "../types/notifications"
import {
  TEMPLATE_LANGUAGES,
  fieldsForOwner,
  fieldsFromOwner,
  messageButtonActions,
  messageFields,
  withExamples,
} from "../utils/booking-templates"

// A business's own message in the shared editor: its wording with fields in
// the owner's words, saved and submitted from its own Koblip Chat. On
// Koblip's number the message is read-only (`editable`).
export function BusinessMessageEditor({
  businessId,
  item,
  limits,
  onClose,
}: {
  businessId: string
  item: NotificationMessage | null
  limits: EditorLimits
  onClose: () => void
}) {
  const t = useOwnerMessages().whatsapp
  const fields = t.fields
  const problemOf = (error: string) => t.problems[error as keyof typeof t.problems] ?? t.failed

  const editorItem: MessageEditorItem | null = item && {
    name: t.names[item.message],
    editable: item.editable,
    fields: messageFields(item.message).map((field) => fields[field]),
    buttonActions: messageButtonActions(item.message),
    texts: Object.fromEntries(
      TEMPLATE_LANGUAGES.map((language) => {
        const text = item.texts[language]
        return [
          language,
          {
            ...text,
            wording: { ...text.wording, body: fieldsForOwner(text.wording.body, fields) },
          },
        ]
      })
    ) as MessageEditorItem["texts"],
  }

  return (
    <MessageEditor
      item={editorItem}
      labels={{ ...t, readOnly: t.koblipWording }}
      limits={limits}
      preview={(body, language) => withExamples(fieldsFromOwner(body, fields), language)}
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
