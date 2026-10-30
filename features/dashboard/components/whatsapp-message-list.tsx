"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { setMessageOn } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { NotificationMessage, TemplateReview } from "../types/notifications"
import type { BookingMessage } from "../utils/booking-templates"
import { MessageEditor, type EditorLimits } from "./message-editor"

// A list of messages, each with a switch, that opens to edit its wording.
// Customer messages and Your alerts both show their messages with it.
export function WhatsappMessageList({
  businessId,
  messages,
  limits,
}: {
  businessId: string
  messages: NotificationMessage[]
  limits: EditorLimits
}) {
  // The open message is read from `messages`, so after a save or submit the
  // page's refresh shows Meta's new review in the editor too.
  const [editing, setEditing] = useState<BookingMessage | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  return (
    <>
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
      <MessageEditor
        key={editorKey}
        businessId={businessId}
        item={messages.find((item) => item.message === editing) ?? null}
        limits={limits}
        onClose={() => setEditing(null)}
      />
    </>
  )
}

// The review a message shows: the worse of its two languages.
function reviewOf(item: NotificationMessage): TemplateReview {
  const both = [item.texts.en.review, item.texts.es.review]
  for (const review of ["rejected", "missing", "draft", "waiting"] as const) {
    if (both.includes(review)) return review
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
  const t = useOwnerMessages().whatsapp
  const router = useRouter()
  const [on, setOn] = useState(item.on)
  const [pending, startTransition] = useTransition()
  const name = t.names[item.message]
  const review = reviewOf(item)

  const toggle = (next: boolean) => {
    setOn(next)
    startTransition(async () => {
      const result = await setMessageOn(businessId, item.message, next).catch(() => null)
      if (result?.ok) {
        router.refresh()
      } else {
        setOn(!next)
        toast.error(t.failed)
      }
    })
  }

  return (
    <Item variant="outline">
      {/* The text opens the editor; the switch is its own control. */}
      <ItemContent className="min-w-0">
        <button
          type="button"
          onClick={onEdit}
          aria-label={t.edit(name)}
          className="flex min-h-11 flex-col items-start justify-center gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription>{t.about[item.message]}</ItemDescription>
        </button>
        {review !== "approved" && (
          <Badge
            variant={review === "rejected" ? "destructive" : "secondary"}
            className="mt-1"
          >
            {t.review[review]}
          </Badge>
        )}
      </ItemContent>
      <ItemActions>
        <Switch
          checked={on}
          disabled={pending}
          onCheckedChange={toggle}
          aria-label={t.turnOn(name)}
        />
      </ItemActions>
    </Item>
  )
}
