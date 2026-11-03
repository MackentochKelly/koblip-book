"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AddButtonSelect, ButtonField } from "@/components/button-fields"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { PlusIcon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { WhatsappPreview } from "@/components/whatsapp-preview"
import { saveAutomation } from "../api/automation-actions"
import { useOwnerMessages } from "../i18n/provider"
import type {
  Automation,
  AutomationAction,
  AutomationButton,
  AutomationLanguage,
  AutomationProblem,
  AutomationWording,
} from "../types/automations"

const EDITOR_FORM = "automation-editor"
const ACTIONS: AutomationAction["type"][] = ["bookingLink", "servicesList", "handoff"]
// The one field the words may use (D10).
const BUSINESS_FIELD = "{business}"

export type AutomationLimits = {
  maxBody: number
  maxListBody: number
  maxButtons: number
  maxButtonLabel: number
}

type Draft = { wording: AutomationWording; buttons: AutomationButton[] }
type Problem = { error: AutomationProblem; field?: string }

const newButton = (action: AutomationAction["type"]): AutomationButton => ({
  id: crypto.randomUUID(),
  label: { en: "", es: "" },
  action: { type: action },
})

// Edits a flow: every word in both languages and its buttons (add, remove,
// move up, rename), with the message as the customer reads it last (U2).
// Both languages save together.
export function AutomationEditor({
  businessId,
  businessName,
  automation,
  limits,
  adding,
  onClose,
}: {
  businessId: string
  businessName: string
  automation: Automation | null
  limits: AutomationLimits
  // Opens with this button added, for the owner to name.
  adding?: AutomationAction["type"]
  onClose: () => void
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const saved = (): Draft | null =>
    automation ? { wording: automation.wording, buttons: automation.buttons } : null
  const [draft, setDraft] = useState<Draft | null>(() => {
    const start = saved()
    return start && adding
      ? { ...start, buttons: [...start.buttons, newButton(adding)] }
      : start
  })
  const [language, setLanguage] = useState<AutomationLanguage>(
    m.locale.startsWith("es") ? "es" : "en"
  )
  const [problem, setProblem] = useState<Problem | null>(null)
  const [pending, startTransition] = useTransition()
  const body = useRef<HTMLTextAreaElement>(null)

  const open = !!automation && !!draft
  const changed = JSON.stringify(draft) !== JSON.stringify(saved())
  const words = draft?.wording[language]
  const unused = ACTIONS.filter(
    (action) => !draft?.buttons.some((button) => button.action.type === action)
  )
  const canAdd = !!draft && unused.length > 0 && draft.buttons.length < limits.maxButtons

  const setWords = (patch: Partial<AutomationWording[AutomationLanguage]>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            wording: { ...current.wording, [language]: { ...current.wording[language], ...patch } },
          }
        : current
    )
  const setButtons = (buttons: AutomationButton[]) =>
    setDraft((current) => (current ? { ...current, buttons } : current))

  // The problem's message when it belongs to this field.
  const errorFor = (field: string) =>
    problem?.field === field ? t.flows.problems[problem.error] : null
  // A problem no single field shows, under the buttons.
  const shown = (field?: string) =>
    !!field &&
    (/^wording\.(en|es)\.(body|handoffReply|servicesIntro)$/.test(field) ||
      /^buttons\.\d+\.label\.(en|es)$/.test(field))

  // Puts {business} where the cursor is in the text.
  const insertBusiness = () => {
    if (!words) return
    const box = body.current
    const start = box?.selectionStart ?? words.body.length
    const end = box?.selectionEnd ?? words.body.length
    setWords({ body: words.body.slice(0, start) + BUSINESS_FIELD + words.body.slice(end) })
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(start + BUSINESS_FIELD.length, start + BUSINESS_FIELD.length)
    })
  }

  // Saves both languages, or with null brings back Book's words. A refusal
  // shows under its field, in its language.
  const save = (next: Draft | null) =>
    automation &&
    startTransition(async () => {
      setProblem(null)
      const result = await saveAutomation(businessId, automation.id, next).catch(() => null)
      if (result?.ok) {
        toast.success(t.flows.saved)
        if (!next) onClose()
        router.refresh()
      } else if (result) {
        const other = result.field?.match(/\.(en|es)(\.|$)/)?.[1] as AutomationLanguage | undefined
        if (other) setLanguage(other)
        setProblem({ error: result.error, field: result.field })
      } else {
        toast.error(t.failed)
      }
    })

  const name = automation ? t.flows.names[automation.trigger] : ""
  // The words a button's reply uses, under the buttons that send them.
  const replies = draft?.buttons.flatMap((button, index) => {
    const key =
      button.action.type === "handoff"
        ? ("handoffReply" as const)
        : button.action.type === "servicesList"
          ? ("servicesIntro" as const)
          : null
    if (!key) return []
    const label = button.label[language] || t.flows.actions[button.action.type]
    return [{ key, index, label }]
  })

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.edit(name)}
      footer={
        <>
          {automation && !automation.isDefault && (
            <Button variant="ghost" disabled={pending} onClick={() => save(null)}>
              {t.reset}
            </Button>
          )}
          <Button type="submit" form={EDITOR_FORM} disabled={pending || !changed}>
            {pending && <Spinner data-icon="inline-start" />}
            {t.save}
          </Button>
        </>
      }
    >
      {draft && words && (
        <form
          id={EDITOR_FORM}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save(draft)
          }}
        >
          <fieldset disabled={pending} className="contents">
            <FieldGroup>
              <Field data-invalid={errorFor(`wording.${language}.body`) ? true : undefined}>
                {/* The words below are in this language: a small switch on
                    the first field's row, as in the message editor. */}
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="automation-body">{t.text}</FieldLabel>
                  <Tabs
                    value={language}
                    onValueChange={(value) => setLanguage(value as AutomationLanguage)}
                  >
                    <TabsList>
                      <TabsTrigger value="en">{t.english}</TabsTrigger>
                      <TabsTrigger value="es">{t.spanish}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <Textarea
                  id="automation-body"
                  ref={body}
                  rows={4}
                  value={words.body}
                  maxLength={limits.maxBody}
                  aria-invalid={errorFor(`wording.${language}.body`) ? true : undefined}
                  onChange={(event) => setWords({ body: event.target.value })}
                />
                {errorFor(`wording.${language}.body`) && (
                  <FieldError>{errorFor(`wording.${language}.body`)}</FieldError>
                )}
              </Field>
              <div className="-mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={insertBusiness}>
                  <PlusIcon data-icon="inline-start" />
                  {t.flows.businessName}
                </Button>
              </div>

              <FieldSet>
                <FieldLegend variant="label">{t.buttons}</FieldLegend>
                {draft.buttons.map((button, index) => {
                  const kind = t.flows.actions[button.action.type]
                  const label = button.label[language] || kind
                  return (
                    <ButtonField
                      key={button.id}
                      id={`automation-button-${button.id}`}
                      value={button.label[language]}
                      kind={kind}
                      maxLength={limits.maxButtonLabel}
                      error={errorFor(`buttons.${index}.label.${language}`)}
                      onChange={(value) =>
                        setButtons(
                          draft.buttons.map((item, at) =>
                            at === index ? { ...item, label: { ...item.label, [language]: value } } : item
                          )
                        )
                      }
                      moveUpLabel={t.flows.moveUp(label)}
                      onMoveUp={
                        index > 0
                          ? () =>
                              setButtons(
                                draft.buttons.map((item, at) =>
                                  at === index - 1
                                    ? draft.buttons[index]
                                    : at === index
                                      ? draft.buttons[index - 1]
                                      : item
                                )
                              )
                          : undefined
                      }
                      removeLabel={t.removeButton(label)}
                      // At least one button stays.
                      onRemove={
                        draft.buttons.length > 1
                          ? () => setButtons(draft.buttons.filter((_, at) => at !== index))
                          : undefined
                      }
                    />
                  )
                })}
                {canAdd && (
                  <AddButtonSelect
                    items={unused.map((action) => ({ value: action, label: t.flows.actions[action] }))}
                    label={t.addButton}
                    onAdd={(action) =>
                      setButtons([...draft.buttons, newButton(action)])
                    }
                  />
                )}
                {problem && !shown(problem.field) && (
                  <FieldError>{t.flows.problems[problem.error]}</FieldError>
                )}
              </FieldSet>

              {replies?.map(({ key, label }) => {
                const field = `wording.${language}.${key}`
                const error = errorFor(field)
                return (
                  <Field key={key} data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor={`automation-${key}`}>{t.flows.replyFor(label)}</FieldLabel>
                    <Textarea
                      id={`automation-${key}`}
                      rows={2}
                      value={words[key]}
                      maxLength={key === "servicesIntro" ? limits.maxListBody : limits.maxBody}
                      aria-invalid={error ? true : undefined}
                      onChange={(event) => setWords({ [key]: event.target.value })}
                    />
                    {error && <FieldError>{error}</FieldError>}
                  </Field>
                )
              })}

              {/* Last: the message as the customer reads it. */}
              <WhatsappPreview
                body={words.body.replaceAll(BUSINESS_FIELD, businessName)}
                buttons={draft.buttons.map((button) => ({
                  key: button.id,
                  label: button.label[language] || t.flows.actions[button.action.type],
                }))}
              />
            </FieldGroup>
          </fieldset>
        </form>
      )}
    </ResponsivePanel>
  )
}
