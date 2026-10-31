"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, XIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { MetaStatusBadge } from "@/components/meta-status-badge"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { WhatsappPreview } from "@/components/whatsapp-preview"
import type { NotificationRules } from "@/lib/notification-rules"
import { saveMessageWording, submitMessageToMeta } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type {
  ButtonAction,
  MessageButton,
  NotificationMessage,
  TemplateReview,
} from "../types/notifications"
import {
  TEMPLATE_LANGUAGES,
  fieldsForOwner,
  fieldsFromOwner,
  messageButtonActions,
  messageFields,
  withExamples,
  type TemplateLanguage,
  type Wording,
} from "../utils/booking-templates"

const EDITOR_FORM = "message-editor"

// The limits the editor shows, from the business's rules (the admin may
// change them; lib/platform-settings.ts).
export type EditorLimits = Pick<
  NotificationRules,
  "maxHeader" | "maxBody" | "maxFooter" | "maxButtons" | "maxButtonLabel"
>

type Draft = { wording: Wording; buttons: MessageButton[] }

// Meta's reviews that "Submit to Meta" can start: never sent, changed since,
// or refused. While Meta reviews, or once it approved, there is nothing to send.
const SUBMITTABLE: readonly TemplateReview[] = ["missing", "draft", "rejected"]

// One message's wording and buttons, English and Spanish on tabs, with a
// preview as the customer sees it and Meta's review of the open language.
// Saving changes only Book; "Submit to Meta" sends what is saved for review
// (decision D8 in docs/plans/whatsapp-notifications.md). On Koblip's number
// the message is read-only (`editable`).
export function MessageEditor({
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
  const router = useRouter()
  const labels = t.fields
  const [language, setLanguage] = useState<TemplateLanguage>("en")
  // The texts as the owner edits them, fields shown as {name}.
  const draftOf = (lang: TemplateLanguage): Draft | null =>
    item
      ? {
          wording: {
            ...item.texts[lang].wording,
            body: fieldsForOwner(item.texts[lang].wording.body, labels),
          },
          buttons: item.texts[lang].buttons,
        }
      : null
  const [drafts, setDrafts] = useState<Record<TemplateLanguage, Draft> | null>(() =>
    item
      ? (Object.fromEntries(TEMPLATE_LANGUAGES.map((lang) => [lang, draftOf(lang)])) as Record<
          TemplateLanguage,
          Draft
        >)
      : null
  )
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const body = useRef<HTMLTextAreaElement>(null)

  const open = !!item && !!drafts
  const draft = drafts?.[language]
  const text = item?.texts[language]
  const name = item ? t.names[item.message] : ""
  const editable = !!item?.editable
  // Unsaved: the open language differs from what Book keeps.
  const changed =
    !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(language))
  const submittable = !!text && SUBMITTABLE.includes(text.review)
  const allowed = item ? messageButtonActions(item.message) : []
  const unused = allowed.filter(
    (action) => !draft?.buttons.some((button) => button.action === action)
  )
  const canAdd = !!draft && unused.length > 0 && draft.buttons.length < limits.maxButtons

  const set = (patch: Partial<Draft>) =>
    setDrafts((current) =>
      current ? { ...current, [language]: { ...current[language], ...patch } } : current
    )
  const setWording = (patch: Partial<Wording>) =>
    draft && set({ wording: { ...draft.wording, ...patch } })
  const setButtons = (buttons: MessageButton[]) => set({ buttons })

  // Puts a field where the cursor is in the text.
  const insert = (label: string) => {
    if (!draft) return
    const box = body.current
    const token = `{${label}}`
    const start = box?.selectionStart ?? draft.wording.body.length
    const end = box?.selectionEnd ?? draft.wording.body.length
    const value = draft.wording.body
    setWording({ body: value.slice(0, start) + token + value.slice(end) })
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  // Saves the open language, or with null brings back Book's wording.
  const save = (next: Draft | null) =>
    startTransition(async () => {
      if (!item) return
      setProblem(null)
      const result = await saveMessageWording(
        businessId,
        item.message,
        language,
        next && { ...next.wording, body: fieldsFromOwner(next.wording.body, labels) },
        next && next.buttons
      ).catch(() => null)
      if (result?.ok) {
        toast.success(t.saved)
        if (!next) {
          onClose()
        }
        router.refresh()
      } else if (result) {
        setProblem(t.problems[result.error] ?? t.failed)
      } else {
        toast.error(t.failed)
      }
    })

  const submit = () =>
    startTransition(async () => {
      if (!item) return
      setProblem(null)
      const result = await submitMessageToMeta(businessId, item.message, language).catch(
        () => null
      )
      if (result?.ok) {
        toast.success(t.submitted)
        router.refresh()
      } else if (result && "reason" in result) {
        // Meta refused at once: its own words.
        setProblem(result.reason)
      } else if (result) {
        setProblem(t.problems[result.error] ?? t.failed)
      } else {
        toast.error(t.failed)
      }
    })

  const preview = draft
    ? withExamples(fieldsFromOwner(draft.wording.body, labels), language)
    : ""

  // One main action: Save while something changed, else Submit to Meta when
  // Meta has nothing current to review.
  const main = !editable ? null : changed ? "save" : submittable ? "submit" : "save"

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.edit(name)}
      footer={
        editable && (
          <>
            {text && !text.isDefault && (
              <Button variant="ghost" disabled={pending} onClick={() => save(null)}>
                {t.reset}
              </Button>
            )}
            {main === "submit" ? (
              <Button disabled={pending} onClick={submit}>
                {pending && <Spinner data-icon="inline-start" />}
                {t.submit}
              </Button>
            ) : (
              <Button type="submit" form={EDITOR_FORM} disabled={pending || !changed}>
                {pending && <Spinner data-icon="inline-start" />}
                {t.save}
              </Button>
            )}
          </>
        )
      }
    >
      {item && draft && text && (
        <form
          id={EDITOR_FORM}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save(draft)
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

            {editable ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t.metaStatus}</span>
                <MetaStatusBadge review={text.review} labels={t.review} />
              </div>
            ) : (
              <FieldDescription>{t.koblipWording}</FieldDescription>
            )}
            {editable && text.review === "rejected" && text.reason && (
              <Alert variant="destructive">
                <AlertTitle>{t.metaReason}</AlertTitle>
                <AlertDescription>{text.reason}</AlertDescription>
              </Alert>
            )}

            {/* On Koblip's number the wording is Koblip's: read-only. */}
            <fieldset disabled={!editable || pending} className="contents">
              <Field>
                <FieldLabel htmlFor="message-header">{t.title}</FieldLabel>
                <Input
                  id="message-header"
                  value={draft.wording.header}
                  maxLength={limits.maxHeader}
                  onChange={(event) => setWording({ header: event.target.value })}
                />
              </Field>
              <Field data-invalid={problem ? true : undefined}>
                <FieldLabel htmlFor="message-body">{t.text}</FieldLabel>
                <Textarea
                  id="message-body"
                  ref={body}
                  rows={4}
                  value={draft.wording.body}
                  maxLength={limits.maxBody}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? "message-problem" : undefined}
                  onChange={(event) => setWording({ body: event.target.value })}
                />
                {problem && <FieldError id="message-problem">{problem}</FieldError>}
              </Field>
              {editable && (
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
              )}
              <Field>
                <FieldLabel htmlFor="message-footer">{t.footer}</FieldLabel>
                <Input
                  id="message-footer"
                  value={draft.wording.footer}
                  maxLength={limits.maxFooter}
                  onChange={(event) => setWording({ footer: event.target.value })}
                />
              </Field>

              {allowed.length > 0 && (
                <FieldSet>
                  <FieldLegend variant="label">{t.buttons}</FieldLegend>
                  {draft.buttons.map((button, index) => (
                    <ButtonField
                      key={button.action}
                      button={button}
                      maxLength={limits.maxButtonLabel}
                      editable={editable}
                      onChange={(label) =>
                        setButtons(
                          draft.buttons.map((item, at) => (at === index ? { ...item, label } : item))
                        )
                      }
                      onRemove={() =>
                        setButtons(draft.buttons.filter((_, at) => at !== index))
                      }
                    />
                  ))}
                  {editable && canAdd && (
                    <AddButton
                      actions={unused}
                      onAdd={(action) =>
                        setButtons([...draft.buttons, { action, label: "" }])
                      }
                    />
                  )}
                </FieldSet>
              )}
            </fieldset>

            <Field>
              <FieldLabel>{t.preview}</FieldLabel>
              <WhatsappPreview
                header={draft.wording.header}
                body={preview}
                footer={draft.wording.footer}
                buttons={draft.buttons.map((button) => ({
                  key: button.action,
                  label: button.label || t.buttonKinds[button.action],
                }))}
              />
              {editable && <FieldDescription>{t.reviewHint}</FieldDescription>}
            </Field>
          </FieldGroup>
        </form>
      )}
    </ResponsivePanel>
  )
}

// One button: its text, what it does, and a way to remove it.
function ButtonField({
  button,
  maxLength,
  editable,
  onChange,
  onRemove,
}: {
  button: MessageButton
  maxLength: number
  editable: boolean
  onChange: (label: string) => void
  onRemove: () => void
}) {
  const t = useOwnerMessages().whatsapp
  const id = `message-button-${button.action}`
  const kind = t.buttonKinds[button.action]
  return (
    <Field>
      <FieldLabel htmlFor={id} className="sr-only">
        {kind}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          value={button.label}
          maxLength={maxLength}
          placeholder={kind}
          onChange={(event) => onChange(event.target.value)}
        />
        {editable && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t.removeButton(button.label || kind)}
              onClick={onRemove}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <FieldDescription>{kind}</FieldDescription>
    </Field>
  )
}

// Adds one of the buttons this message may still take.
function AddButton({
  actions,
  onAdd,
}: {
  actions: ButtonAction[]
  onAdd: (action: ButtonAction) => void
}) {
  const t = useOwnerMessages().whatsapp
  const items = actions.map((action) => ({ value: action, label: t.buttonKinds[action] }))
  return (
    <Select
      items={items}
      value={null}
      onValueChange={(value) => value && onAdd(value as ButtonAction)}
    >
      <SelectTrigger aria-label={t.addButton}>
        <PlusIcon />
        <SelectValue placeholder={t.addButton} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
