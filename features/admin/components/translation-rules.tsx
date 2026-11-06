"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { ChevronRightIcon } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import type { TranslationRuleSetting } from "@/lib/translations/settings"
import { saveTranslationRule } from "../api/translation-actions"
import { useAdminMessages } from "../i18n/provider"
import {
  formatTranslationRule,
  parseTranslationRule,
  TRANSLATION_RULE_UNITS,
  translationRuleInput,
} from "../utils/translation-rule-values"

const FORM = "translation-rule-form"

// Admin → Translations → Rules (G5): each rule with the value in use; a
// changed one shows its default. Tapping one opens it to change or go back
// to the default, as WhatsApp's Rules do. The server checks each value and
// logs the change (History).
export function TranslationRules({ rules }: { rules: TranslationRuleSetting[] }) {
  const m = useAdminMessages()
  const t = m.translations.rules
  // The rule being edited; kept while the panel closes, so it stays drawn.
  const [opened, setOpened] = useState<TranslationRuleSetting | null>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  // The value the panel opened with: Save waits for a change.
  const [start, setStart] = useState("")
  const [invalid, setInvalid] = useState(false)
  const [pending, startTransition] = useTransition()

  function edit(rule: TranslationRuleSetting) {
    setOpened(rule)
    const current = translationRuleInput(rule.key, rule.value ?? rule.defaultValue)
    setInput(current)
    setStart(current)
    setInvalid(false)
    setOpen(true)
  }

  function save(value: unknown) {
    if (!opened) return
    if (value === undefined) {
      setInvalid(true)
      return
    }
    startTransition(async () => {
      const done = await saveTranslationRule(opened.key, value).catch(() => null)
      if (done?.ok) {
        setOpen(false)
        toast.success(t.saved)
      } else if (done?.ok === false && done.error === "invalid") {
        setInvalid(true)
      } else {
        toast.error(t.failed)
      }
    })
  }

  const fieldId = opened ? `translation-rule-${opened.key}` : undefined

  return (
    <div className="flex flex-col gap-6">
      <ItemGroup className="gap-3">
        {rules.map((rule) => {
          const changed = rule.value !== null
          return (
            <Item
              key={rule.key}
              variant="outline"
              render={<button type="button" onClick={() => edit(rule)} />}
            >
              <ItemContent className="min-w-0">
                <ItemTitle>{t.names[rule.key]}</ItemTitle>
                <ItemDescription className="break-words">
                  {formatTranslationRule(
                    rule.key,
                    changed ? rule.value : rule.defaultValue,
                    m
                  )}
                  {changed &&
                    ` · ${t.byDefault(formatTranslationRule(rule.key, rule.defaultValue, m))}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {changed && <Badge variant="secondary">{t.changed}</Badge>}
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>

      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={opened ? t.names[opened.key] : ""}
        footer={
          <>
            {opened?.value !== null && opened?.value !== undefined && (
              <Button
                variant="outline"
                size="lg"
                disabled={pending}
                onClick={() => save(null)}
              >
                {t.useDefault}
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              form={FORM}
              disabled={pending || input === start}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {t.save}
            </Button>
          </>
        }
      >
        {opened && (
          <form
            id={FORM}
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              save(parseTranslationRule(opened.key, input))
            }}
          >
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor={fieldId}>
                {t.units[TRANSLATION_RULE_UNITS[opened.key]]}
              </FieldLabel>
              <Input
                id={fieldId}
                inputMode={
                  TRANSLATION_RULE_UNITS[opened.key] === "minutesList"
                    ? "text"
                    : "numeric"
                }
                value={input}
                aria-invalid={invalid || undefined}
                onChange={(event) => {
                  setInput(event.target.value)
                  setInvalid(false)
                }}
              />
              {invalid && <FieldError>{t.invalid}</FieldError>}
            </Field>
            <FieldDescription>
              {t.byDefault(
                formatTranslationRule(opened.key, opened.defaultValue, m)
              )}
            </FieldDescription>
          </form>
        )}
      </ResponsivePanel>
    </div>
  )
}
