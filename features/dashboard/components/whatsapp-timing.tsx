"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, XIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { TimeInput } from "@/components/time-input"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
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
import { formatDuration } from "@/lib/format-duration"
import type { NotificationRules } from "@/lib/notification-rules"
import { saveNotificationSettings } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { NotificationSettings } from "../types/notifications"

// Timing: when reminders go and the quiet hours, saved together. The
// reminder choices are the business's rules, which the admin may change.
export function WhatsappTiming({
  businessId,
  settings,
  rules,
}: {
  businessId: string
  settings: NotificationSettings
  rules: Pick<NotificationRules, "reminderChoices" | "maxReminders">
}) {
  const t = useOwnerMessages().whatsapp
  const router = useRouter()
  const [reminders, setReminders] = useState(settings.reminders)
  const [adding, setAdding] = useState<string | null>(null)
  const [quietStart, setQuietStart] = useState(settings.quietStart)
  const [quietEnd, setQuietEnd] = useState(settings.quietEnd)
  const [pending, startTransition] = useTransition()

  const choices = rules.reminderChoices.filter(
    (minutes) => !reminders.includes(minutes)
  )
  const full = reminders.length >= rules.maxReminders
  const items = choices.map((minutes) => ({
    value: String(minutes),
    label: t.before(formatDuration(minutes)),
  }))

  const save = () => {
    startTransition(async () => {
      const result = await saveNotificationSettings(businessId, {
        ownerPhone: settings.ownerPhone,
        ownerLanguage: settings.ownerLanguage,
        reminders,
        quietStart,
        quietEnd,
      }).catch(() => null)
      if (result?.ok) {
        toast.success(t.settingsSaved)
        router.refresh()
      } else {
        toast.error(t.failed)
      }
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <PageSection id="reminders" title={t.reminders}>
        <ItemGroup className="gap-3">
          {reminders.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.noReminders}</p>
          )}
          {[...reminders]
            .sort((a, b) => b - a)
            .map((minutes) => {
              const time = formatDuration(minutes)
              return (
                <Item key={minutes} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{t.before(time)}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.removeReminder(time)}
                      onClick={() =>
                        setReminders((list) => list.filter((value) => value !== minutes))
                      }
                    >
                      <XIcon />
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
        </ItemGroup>
        {!full && (
          <Field orientation="horizontal">
            <Select
              items={items}
              value={adding}
              onValueChange={(value) => setAdding(value ? String(value) : null)}
            >
              <SelectTrigger className="flex-1" aria-label={t.addReminder}>
                <SelectValue placeholder={t.addReminder} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!adding}
              onClick={() => {
                if (!adding) return
                setReminders((list) => [...list, Number(adding)])
                setAdding(null)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              {t.addField}
            </Button>
          </Field>
        )}
      </PageSection>

      <PageSection id="quiet-hours" title={t.quietHours}>
        <FieldGroup>
          <Field>
            <FieldDescription>{t.quietHint}</FieldDescription>
            <div className="flex items-center gap-2">
              <TimeInput
                aria-label={t.from}
                value={quietStart}
                onChange={(event) => setQuietStart(event.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <TimeInput
                aria-label={t.to}
                value={quietEnd}
                onChange={(event) => setQuietEnd(event.target.value)}
              />
            </div>
          </Field>
        </FieldGroup>
      </PageSection>

      <Button size="lg" onClick={save} disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        {t.saveSettings}
      </Button>
    </div>
  )
}
