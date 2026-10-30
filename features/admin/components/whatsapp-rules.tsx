"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { TimeInput } from "@/components/time-input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import type { NotificationRuleKey } from "@/lib/notification-rules"
import { saveWhatsappRule } from "../api/whatsapp-rule-actions"
import { useAdminMessages } from "../i18n/provider"
import {
  formatRuleValue,
  parseRuleInput,
  ruleInputOf,
} from "../utils/rule-values"
import {
  CANT_COME_CHOICES,
  RULE_GROUPS,
  RULE_UNITS,
} from "../utils/whatsapp-rules"

export type RuleSetting = {
  key: NotificationRuleKey
  defaultValue: unknown
  // The admin's value, or null for the default.
  value: unknown
  perBusiness: boolean
}

const FORM = "whatsapp-rule-form"

// WhatsApp → Rules (A7): every rule in its group with the value in use; a
// changed one shows its default. Tapping one opens it to change or go back
// to the default. The server checks each value and logs the change.
export function WhatsappRules({ rules }: { rules: RuleSetting[] }) {
  const m = useAdminMessages()
  const t = m.whatsapp.rules
  const byKey = new Map(rules.map((rule) => [rule.key, rule]))
  // The rule being edited; kept while the panel closes, so it stays drawn.
  const [opened, setOpened] = useState<RuleSetting | null>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [invalid, setInvalid] = useState(false)
  const [pending, startTransition] = useTransition()

  function edit(rule: RuleSetting) {
    setOpened(rule)
    setInput(ruleInputOf(rule.key, rule.value ?? rule.defaultValue))
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
      const done = await saveWhatsappRule(opened.key, value).catch(() => null)
      if (done?.ok) {
        setOpen(false)
        toast.success(t.saved)
      } else if (done?.error === "invalid") {
        setInvalid(true)
      } else {
        toast.error(t.failed)
      }
    })
  }

  const unit = opened ? RULE_UNITS[opened.key] : null
  const field = (() => {
    if (!opened || !unit) return null
    const id = `rule-${opened.key}`
    if (unit === "switch") {
      return (
        <Field orientation="horizontal">
          <FieldLabel htmlFor={id}>{t.names[opened.key]}</FieldLabel>
          <Switch
            id={id}
            checked={input === "true"}
            onCheckedChange={(on) => setInput(String(on))}
          />
        </Field>
      )
    }
    if (unit === "cantCome") {
      const items = CANT_COME_CHOICES.map((choice) => ({
        value: choice,
        label: t.cantCome[choice],
      }))
      return (
        <Field>
          <Select
            items={items}
            value={input}
            onValueChange={(value) => setInput(String(value))}
          >
            <SelectTrigger className="w-full" aria-label={t.names[opened.key]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )
    }
    if (unit === "clock") {
      return (
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor={id}>{t.names[opened.key]}</FieldLabel>
          <TimeInput
            id={id}
            value={input}
            aria-invalid={invalid || undefined}
            onChange={(event) => setInput(event.target.value)}
          />
          {invalid && <FieldError>{t.invalid}</FieldError>}
        </Field>
      )
    }
    return (
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={id}>{t.units[unit]}</FieldLabel>
        <Input
          id={id}
          inputMode={unit === "minutesList" ? "text" : "decimal"}
          value={input}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setInput(event.target.value)
            setInvalid(false)
          }}
        />
        {invalid && <FieldError>{t.invalid}</FieldError>}
      </Field>
    )
  })()

  return (
    <div className="flex flex-col gap-6">
      {RULE_GROUPS.map((group) => (
        <section
          key={group.id}
          className="flex flex-col gap-3"
          aria-labelledby={`rules-${group.id}`}
        >
          <h2
            id={`rules-${group.id}`}
            className="text-lg font-semibold tracking-tight"
          >
            {t.groups[group.id]}
          </h2>
          <ItemGroup className="gap-3">
            {group.keys.map((key) => {
              const rule = byKey.get(key)
              if (!rule) return null
              const changed = rule.value !== null
              return (
                <Item
                  key={key}
                  variant="outline"
                  render={<button type="button" onClick={() => edit(rule)} />}
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle>{t.names[key]}</ItemTitle>
                    <ItemDescription className="break-words">
                      {formatRuleValue(
                        key,
                        changed ? rule.value : rule.defaultValue,
                        m
                      )}
                      {changed &&
                        ` · ${t.byDefault(formatRuleValue(key, rule.defaultValue, m))}`}
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
        </section>
      ))}

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
            <Button type="submit" size="lg" form={FORM} disabled={pending}>
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
              save(parseRuleInput(opened.key, input))
            }}
          >
            {field}
            <FieldDescription>
              {opened.perBusiness
                ? `${t.byDefault(formatRuleValue(opened.key, opened.defaultValue, m))} · ${t.perBusiness}`
                : t.byDefault(
                    formatRuleValue(opened.key, opened.defaultValue, m)
                  )}
            </FieldDescription>
          </form>
        )}
      </ResponsivePanel>
    </div>
  )
}
