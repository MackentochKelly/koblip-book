"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import { saveMessageWording } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { NotificationMessage } from "../types/notifications"
import {
  TEMPLATE_LANGUAGES,
  fieldsForOwner,
  fieldsFromOwner,
  messageFields,
  withExamples,
  type TemplateLanguage,
  type Wording,
} from "../utils/booking-templates"

const EDITOR_FORM = "message-editor"

// One message's wording, English and Spanish on tabs: title, text with
// field buttons, footer, and a preview as the customer sees it. Saving sends
// it to Meta for review again; Reset brings back Book's wording.
export function MessageEditor({
  businessId,
  item,
  onClose,
}: {
  businessId: string
  item: NotificationMessage | null
  onClose: () => void
}) {
  const t = useOwnerMessages().whatsapp
  const router = useRouter()
  const labels = t.fields
  const [language, setLanguage] = useState<TemplateLanguage>("en")
  const [drafts, setDrafts] = useState<Record<TemplateLanguage, Wording> | null>(() =>
    item
      ? (Object.fromEntries(
          TEMPLATE_LANGUAGES.map((lang) => {
            const { wording } = item.texts[lang]
            return [lang, { ...wording, body: fieldsForOwner(wording.body, labels) }]
          })
        ) as Record<TemplateLanguage, Wording>)
      : null
  )
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const body = useRef<HTMLTextAreaElement>(null)

  const open = !!item && !!drafts
  const draft = drafts?.[language]
  const name = item ? t.names[item.message] : ""
  const set = (patch: Partial<Wording>) =>
    setDrafts((current) =>
      current ? { ...current, [language]: { ...current[language], ...patch } } : current
    )

  // Puts a field where the cursor is in the text.
  const insert = (label: string) => {
    if (!draft) return
    const box = body.current
    const token = `{${label}}`
    const start = box?.selectionStart ?? draft.body.length
    const end = box?.selectionEnd ?? draft.body.length
    set({ body: draft.body.slice(0, start) + token + draft.body.slice(end) })
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const send = (wording: Wording | null) =>
    startTransition(async () => {
      if (!item) return
      setProblem(null)
      const result = await saveMessageWording(
        businessId,
        item.message,
        language,
        wording && { ...wording, body: fieldsFromOwner(wording.body, labels) }
      ).catch(() => null)
      if (result?.ok) {
        toast.success(t.saved)
        router.refresh()
        onClose()
      } else if (result) {
        setProblem(t.problems[result.error] ?? t.failed)
      } else {
        toast.error(t.failed)
      }
    })

  const preview = draft ? withExamples(fieldsFromOwner(draft.body, labels), language) : ""

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.edit(name)}
      footer={
        <>
          {item && !item.texts[language].isDefault && (
            <Button variant="ghost" disabled={pending} onClick={() => send(null)}>
              {t.reset}
            </Button>
          )}
          <Button type="submit" form={EDITOR_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t.save}
          </Button>
        </>
      }
    >
      {item && draft && (
        <form
          id={EDITOR_FORM}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            send(draft)
          }}
        >
          <FieldGroup>
            <Tabs
              value={language}
              onValueChange={(value) => {
                setLanguage(value as TemplateLanguage)
                setProblem(null)
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="en">{t.english}</TabsTrigger>
                <TabsTrigger value="es">{t.spanish}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Field>
              <FieldLabel htmlFor="message-header">{t.title}</FieldLabel>
              <Input
                id="message-header"
                value={draft.header}
                maxLength={NOTIFICATION_RULES.maxHeader}
                onChange={(event) => set({ header: event.target.value })}
              />
            </Field>
            <Field data-invalid={problem ? true : undefined}>
              <FieldLabel htmlFor="message-body">{t.text}</FieldLabel>
              <Textarea
                id="message-body"
                ref={body}
                rows={4}
                value={draft.body}
                maxLength={NOTIFICATION_RULES.maxBody}
                aria-invalid={problem ? true : undefined}
                onChange={(event) => set({ body: event.target.value })}
              />
              {problem && <FieldError>{problem}</FieldError>}
            </Field>
              <div className="-mt-4 flex flex-wrap gap-2">
                {messageFields(item.message).map((field) => (
                  <Button
                    key={field}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insert(labels[field])}
                  >
                    <PlusIcon data-icon="inline-start" />
                    {labels[field]}
                  </Button>
                ))}
              </div>
            <Field>
              <FieldLabel htmlFor="message-footer">{t.footer}</FieldLabel>
              <Input
                id="message-footer"
                value={draft.footer}
                maxLength={NOTIFICATION_RULES.maxFooter}
                onChange={(event) => set({ footer: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{t.preview}</FieldLabel>
              <div className="rounded-xl bg-muted p-3">
                <Bubble variant="outline">
                  <BubbleContent className="flex flex-col gap-1 whitespace-pre-wrap">
                    <span className="font-semibold">{draft.header}</span>
                    <span>{preview}</span>
                    {draft.footer && (
                      <span className="text-xs text-muted-foreground">{draft.footer}</span>
                    )}
                  </BubbleContent>
                </Bubble>
              </div>
              <FieldDescription>{t.reviewHint}</FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      )}
    </ResponsivePanel>
  )
}
