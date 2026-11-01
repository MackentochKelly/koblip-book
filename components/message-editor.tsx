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
import type { ButtonAction, TemplateReview } from "@/types/whatsapp"

const EDITOR_FORM = "message-editor"
const LANGUAGES = ["en", "es"] as const

export type EditorLanguage = (typeof LANGUAGES)[number]

// The limits the editor shows, from the rules (the admin may change them;
// lib/platform-settings.ts).
export type EditorLimits = Pick<
  NotificationRules,
  "maxHeader" | "maxBody" | "maxFooter" | "maxButtons" | "maxButtonLabel"
>

export type EditorWording = { header: string; body: string; footer: string }
export type EditorButton = { action: ButtonAction; label: string }
export type EditorDraft = { wording: EditorWording; buttons: EditorButton[] }

// One message as the editor shows it. Fields in the text are already the
// reader's own words ({Name}), as typed and as the field buttons insert them.
export type MessageEditorItem = {
  name: string
  // False: read-only, with `labels.readOnly` saying why.
  editable: boolean
  fields: string[]
  buttonActions: ButtonAction[]
  texts: Record<
    EditorLanguage,
    EditorDraft & {
      // Book's wording, nothing saved: no Reset.
      isDefault: boolean
      review: TemplateReview
      // Meta's reason when it refused, in Meta's words.
      reason: string | null
      // What goes outside 24 hours: the words Meta approved, or null until
      // Meta approved a version (docs/plans/message-editing.md, D1).
      approved?: EditorDraft | null
    }
  >
}

// What a save or submit answers: the problem in the reader's words, or null
// for a plain "couldn't save" toast.
export type EditorResult = { ok: true } | { ok: false; problem: string | null }

export type MessageEditorLabels = {
  edit: (name: string) => string
  english: string
  spanish: string
  metaReason: string
  review: Record<TemplateReview, string>
  readOnly: string
  title: string
  text: string
  footer: string
  buttons: string
  buttonKinds: Record<ButtonAction, string>
  addButton: string
  removeButton: (label: string) => string
  normalMessage: string
  normalHint: string
  template: string
  templateHint: string
  approvedNow: string
  reset: string
  save: string
  submit: string
  saved: string
  submitted: string
  failed: string
}

// Meta's reviews that "Submit to Meta" can start: never sent, changed since,
// or refused. While Meta reviews, or once it approved, there is nothing to send.
const SUBMITTABLE: readonly TemplateReview[] = ["missing", "draft", "rejected"]

// One message's wording and buttons, English and Spanish on tabs, and its two
// ways out shown apart: the normal message (inside 24 hours, the saved words
// at once) and the template (outside 24 hours, with Meta's review and the
// words Meta approved while a change waits).
// Saving keeps a draft; "Submit to Meta" sends what is saved for review
// (D8 in docs/plans/whatsapp-notifications.md). The same editor serves a
// business's own messages and the admin's Koblip messages
// (docs/plans/message-editing.md, D2): the caller brings the actions, the
// words and the preview.
export function MessageEditor({
  item,
  labels,
  limits,
  preview,
  onSave,
  onSubmit,
  onClose,
}: {
  item: MessageEditorItem | null
  labels: MessageEditorLabels
  limits: EditorLimits
  // The text as a customer reads it, with sample values.
  preview: (body: string, language: EditorLanguage) => string
  // null brings back Book's wording.
  onSave: (language: EditorLanguage, draft: EditorDraft | null) => Promise<EditorResult>
  onSubmit: (language: EditorLanguage) => Promise<EditorResult>
  onClose: () => void
}) {
  const t = labels
  const router = useRouter()
  const [language, setLanguage] = useState<EditorLanguage>("en")
  const draftOf = (lang: EditorLanguage): EditorDraft | null =>
    item ? { wording: item.texts[lang].wording, buttons: item.texts[lang].buttons } : null
  const [drafts, setDrafts] = useState<Record<EditorLanguage, EditorDraft> | null>(() =>
    item
      ? (Object.fromEntries(LANGUAGES.map((lang) => [lang, draftOf(lang)])) as Record<
          EditorLanguage,
          EditorDraft
        >)
      : null
  )
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const body = useRef<HTMLTextAreaElement>(null)

  const open = !!item && !!drafts
  const draft = drafts?.[language]
  const text = item?.texts[language]
  const editable = !!item?.editable
  // Unsaved: the open language differs from what is kept.
  const changed = !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(language))
  const submittable = !!text && SUBMITTABLE.includes(text.review)
  // The template still sends what Meta approved while the saved words differ.
  const approved =
    text?.approved &&
    JSON.stringify(text.approved) !== JSON.stringify(draftOf(language))
      ? text.approved
      : null
  const allowed = item?.buttonActions ?? []
  const unused = allowed.filter(
    (action) => !draft?.buttons.some((button) => button.action === action)
  )
  const canAdd = !!draft && unused.length > 0 && draft.buttons.length < limits.maxButtons

  const set = (patch: Partial<EditorDraft>) =>
    setDrafts((current) =>
      current ? { ...current, [language]: { ...current[language], ...patch } } : current
    )
  const setWording = (patch: Partial<EditorWording>) =>
    draft && set({ wording: { ...draft.wording, ...patch } })
  const setButtons = (buttons: EditorButton[]) => set({ buttons })

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

  // Runs a save or submit: the toast on success, the problem under the text
  // on a refusal, a toast when it couldn't run.
  const run = (task: () => Promise<EditorResult>, done: string, after?: () => void) =>
    startTransition(async () => {
      setProblem(null)
      const result = await task().catch(() => null)
      if (result?.ok) {
        toast.success(done)
        after?.()
        router.refresh()
      } else if (result?.problem) {
        setProblem(result.problem)
      } else {
        toast.error(t.failed)
      }
    })

  // Saves the open language, or with null brings back Book's wording.
  const save = (next: EditorDraft | null) =>
    run(() => onSave(language, next), t.saved, next ? undefined : onClose)
  const submit = () => run(() => onSubmit(language), t.submitted)

  // One main action: Save while something changed, else Submit to Meta when
  // Meta has nothing current to review.
  const main = !editable ? null : changed ? "save" : submittable ? "submit" : "save"

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={item ? t.edit(item.name) : ""}
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
                setLanguage(value as EditorLanguage)
                setProblem(null)
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="en">{t.english}</TabsTrigger>
                <TabsTrigger value="es">{t.spanish}</TabsTrigger>
              </TabsList>
            </Tabs>

            {!editable && <FieldDescription>{t.readOnly}</FieldDescription>}

            {/* A message the reader can't change is read-only. */}
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
                  {item.fields.map((field) => (
                    <Button
                      key={field}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insert(field)}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {field}
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
                      labels={t}
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
                      labels={t}
                      onAdd={(action) =>
                        setButtons([...draft.buttons, { action, label: "" }])
                      }
                    />
                  )}
                </FieldSet>
              )}
            </fieldset>

            <FieldSet>
              <FieldLegend variant="label">{t.normalMessage}</FieldLegend>
              <FieldDescription>{t.normalHint}</FieldDescription>
              <MessagePreview draft={draft} language={language} preview={preview} labels={t} />
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label" className="flex items-center gap-2">
                {t.template}
                {editable && <MetaStatusBadge review={text.review} labels={t.review} />}
              </FieldLegend>
              <FieldDescription>{t.templateHint}</FieldDescription>
              {editable && text.review === "rejected" && text.reason && (
                <Alert variant="destructive">
                  <AlertTitle>{t.metaReason}</AlertTitle>
                  <AlertDescription>{text.reason}</AlertDescription>
                </Alert>
              )}
              {approved && (
                <>
                  <MessagePreview draft={approved} language={language} preview={preview} labels={t} />
                  <FieldDescription>{t.approvedNow}</FieldDescription>
                </>
              )}
            </FieldSet>
          </FieldGroup>
        </form>
      )}
    </ResponsivePanel>
  )
}

// One version of the message as a customer reads it on WhatsApp.
function MessagePreview({
  draft,
  language,
  preview,
  labels,
}: {
  draft: EditorDraft
  language: EditorLanguage
  preview: (body: string, language: EditorLanguage) => string
  labels: MessageEditorLabels
}) {
  return (
    <WhatsappPreview
      header={draft.wording.header}
      body={preview(draft.wording.body, language)}
      footer={draft.wording.footer}
      buttons={draft.buttons.map((button) => ({
        key: button.action,
        label: button.label || labels.buttonKinds[button.action],
      }))}
    />
  )
}

// One button: its text, what it does, and a way to remove it.
function ButtonField({
  button,
  labels,
  maxLength,
  editable,
  onChange,
  onRemove,
}: {
  button: EditorButton
  labels: MessageEditorLabels
  maxLength: number
  editable: boolean
  onChange: (label: string) => void
  onRemove: () => void
}) {
  const id = `message-button-${button.action}`
  const kind = labels.buttonKinds[button.action]
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
              aria-label={labels.removeButton(button.label || kind)}
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
  labels,
  onAdd,
}: {
  actions: ButtonAction[]
  labels: MessageEditorLabels
  onAdd: (action: ButtonAction) => void
}) {
  const items = actions.map((action) => ({ value: action, label: labels.buttonKinds[action] }))
  return (
    <Select
      items={items}
      value={null}
      onValueChange={(value) => value && onAdd(value as ButtonAction)}
    >
      <SelectTrigger aria-label={labels.addButton}>
        <PlusIcon />
        <SelectValue placeholder={labels.addButton} />
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
