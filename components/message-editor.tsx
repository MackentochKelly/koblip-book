"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleCheckIcon, PlusIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { AppSelect } from "@/components/app-select"
import { AddButtonSelect, ButtonField } from "@/components/button-fields"
import { MetaStatusBadge } from "@/components/meta-status-badge"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { WhatsappPreview } from "@/components/whatsapp-preview"
import { CONTROL_SIZE } from "@/lib/control-size"
import type { NotificationRules } from "@/lib/notification-rules"
import { LANGUAGE_NAMES, PAGE_LANGUAGES, type PageLanguage } from "@/lib/page-language"
import type { ButtonAction, TemplateReview } from "@/types/whatsapp"

const EDITOR_FORM = "message-editor"
// A message is written in every page language, each its own template.
const LANGUAGES = PAGE_LANGUAGES
// The message's two ways out, each on its own tab.
type Part = "normal" | "template"

export type EditorLanguage = PageLanguage

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
  // The language picker's name; each language is named in itself.
  language: string
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
  // The normal message's status: it goes out as soon as it is saved.
  sending: string
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

// One message's two ways out on tabs at the top, each with its own status:
// the normal message (inside 24 hours, the saved words at once) and the
// template (outside 24 hours, with Meta's review). One set of words is edited
// below for both, its language switched on the first field's row, and the
// preview comes last (for the template, the words Meta approved while a
// change waits).
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
  const [part, setPart] = useState<Part>("normal")
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

  // One main action: Save while something changed; on the Template tab,
  // Submit to Meta when Meta has nothing current to review.
  const main =
    !editable ? null : !changed && part === "template" && submittable ? "submit" : "save"

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={item ? t.edit(item.name) : ""}
      footer={
        editable && (
          <>
            {text && !text.isDefault && (
              <Button variant="ghost" size="lg" disabled={pending} onClick={() => save(null)}>
                {t.reset}
              </Button>
            )}
            {main === "submit" ? (
              <Button size="lg" disabled={pending} onClick={submit}>
                {pending && <Spinner data-icon="inline-start" />}
                {t.submit}
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                form={EDITOR_FORM}
                disabled={pending || !changed}
              >
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
            <Tabs value={part} onValueChange={(value) => setPart(value as Part)}>
              <TabsList className="w-full">
                <TabsTrigger value="normal" className={CONTROL_SIZE.tabTapArea}>
                  {t.normalMessage}
                </TabsTrigger>
                <TabsTrigger value="template" className={CONTROL_SIZE.tabTapArea}>
                  {t.template}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Where this way stands: its status and when it goes. */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {part === "normal" ? (
                  <Badge variant="secondary">
                    <CircleCheckIcon data-icon="inline-start" className="text-success" />
                    {t.sending}
                  </Badge>
                ) : (
                  editable && <MetaStatusBadge review={text.review} labels={t.review} />
                )}
                <FieldDescription>
                  {part === "normal" ? t.normalHint : t.templateHint}
                </FieldDescription>
              </div>
              {part === "template" && editable && text.review === "rejected" && text.reason && (
                <Alert variant="destructive">
                  <AlertTitle>{t.metaReason}</AlertTitle>
                  <AlertDescription>{text.reason}</AlertDescription>
                </Alert>
              )}
            </div>

            {!editable && <FieldDescription>{t.readOnly}</FieldDescription>}

            <Field>
              {/* The words below are in this language: a small select on
                  the first field's row (four languages don't fit as tabs
                  on a phone). It sits outside the read-only fieldset, so
                  it always switches. */}
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="message-header">{t.title}</FieldLabel>
                <AppSelect
                  aria-label={t.language}
                  value={language}
                  onValueChange={(value) => {
                    setLanguage(value)
                    setProblem(null)
                  }}
                  options={LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }))}
                />
              </div>
              <Input
                id="message-header"
                value={draft.wording.header}
                maxLength={limits.maxHeader}
                disabled={!editable || pending}
                onChange={(event) => setWording({ header: event.target.value })}
              />
            </Field>

            {/* A message the reader can't change is read-only. */}
            <fieldset disabled={!editable || pending} className="contents">
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
                      id={`message-button-${button.action}`}
                      value={button.label}
                      kind={t.buttonKinds[button.action]}
                      maxLength={limits.maxButtonLabel}
                      onChange={(label) =>
                        setButtons(
                          draft.buttons.map((item, at) => (at === index ? { ...item, label } : item))
                        )
                      }
                      removeLabel={t.removeButton(button.label || t.buttonKinds[button.action])}
                      onRemove={
                        editable
                          ? () => setButtons(draft.buttons.filter((_, at) => at !== index))
                          : undefined
                      }
                    />
                  ))}
                  {editable && canAdd && (
                    <AddButtonSelect
                      items={unused.map((action) => ({ value: action, label: t.buttonKinds[action] }))}
                      label={t.addButton}
                      onAdd={(action) =>
                        setButtons([...draft.buttons, { action, label: "" }])
                      }
                    />
                  )}
                </FieldSet>
              )}
            </fieldset>

            {/* Last: the message as the customer reads it. On After 24h,
                while a change waits, the words Meta approved still go. */}
            <Field>
              <MessagePreview
                draft={part === "template" ? (approved ?? draft) : draft}
                language={language}
                preview={preview}
                labels={t}
              />
              {part === "template" && approved && (
                <FieldDescription>{t.approvedNow}</FieldDescription>
              )}
            </Field>
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
