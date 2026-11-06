"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { HelperLine } from "@/components/helper-line"
import { MessageStatus } from "@/components/message-status"
import { SwitchCard } from "@/components/switch-card"
import { ItemGroup } from "@/components/ui/item"
import { setMessageOn } from "../api/notification-actions"
import type { NotificationMessage, TemplateReview } from "../types/notifications"
import {
  TEMPLATE_LANGUAGES,
  type BookingField,
  type BookingMessage,
  type TemplateLanguage,
} from "../utils/booking-templates"
import type { EditorLimits } from "@/components/message-editor"
import { BusinessMessageEditor } from "./business-message-editor"

// A list of messages, each with a switch, that opens to edit its wording.
// Customer messages and Your alerts both show their messages with it.
export function WhatsappMessageList({
  businessId,
  messages,
  limits,
  examples,
}: {
  businessId: string
  messages: NotificationMessage[]
  limits: EditorLimits
  examples: Record<TemplateLanguage, Record<BookingField, string>>
}) {
  // The open message is read from `messages`, so after a save or submit the
  // page's refresh shows Meta's new review in the editor too.
  const [editing, setEditing] = useState<BookingMessage | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const t = useTranslations("owner.whatsapp")
  return (
    <div className="flex flex-col gap-3">
      <HelperLine more={t("listMore")} moreLabel={t("moreInfo")}>
        {t("listHint")}
      </HelperLine>
      <ItemGroup className="gap-3">
        {messages.map((item) => (
          <MessageRow
            key={item.message}
            businessId={businessId}
            item={item}
            onEdit={() => {
              setEditorKey((value) => value + 1)
              setEditing(item.message)
            }}
          />
        ))}
      </ItemGroup>
      <BusinessMessageEditor
        key={editorKey}
        businessId={businessId}
        item={messages.find((item) => item.message === editing) ?? null}
        limits={limits}
        examples={examples}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

// The review a message shows: the worst of its languages.
function reviewOf(item: NotificationMessage): TemplateReview {
  const all = TEMPLATE_LANGUAGES.map((language) => item.texts[language].review)
  for (const review of ["rejected", "missing", "draft", "waiting"] as const) {
    if (all.includes(review)) return review
  }
  return "approved"
}

function MessageRow({
  businessId,
  item,
  onEdit,
}: {
  businessId: string
  item: NotificationMessage
  onEdit: () => void
}) {
  const t = useTranslations("owner.whatsapp")
  const router = useRouter()
  const [on, setOn] = useState(item.on)
  const [pending, startTransition] = useTransition()
  const name = t(`names.${item.message}`)
  const review = reviewOf(item)

  const toggle = (next: boolean) => {
    setOn(next)
    startTransition(async () => {
      const result = await setMessageOn(businessId, item.message, next).catch(() => null)
      if (result?.ok) {
        router.refresh()
      } else {
        setOn(!next)
        toast.error(t("failed"))
      }
    })
  }

  return (
    <SwitchCard
      title={name}
      description={t(`about.${item.message}`)}
      openLabel={t("edit", { name: name.toLowerCase() })}
      onOpen={onEdit}
      on={on}
      onCheckedChange={toggle}
      switchLabel={t("turnOn", { name: name.toLowerCase() })}
      switchDisabled={pending}
    >
      <MessageStatus
        on={on}
        review={review}
        labels={{
          normalMessage: t("normalMessage"),
          template: t("template"),
          sending: t("sending"),
          off: t("off"),
          review: {
            missing: t("review.missing"),
            draft: t("review.draft"),
            waiting: t("review.waiting"),
            approved: t("review.approved"),
            rejected: t("review.rejected"),
          },
        }}
      />
    </SwitchCard>
  )
}
