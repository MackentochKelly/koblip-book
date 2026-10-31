"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import type { PageLanguage } from "@/lib/page-language"
import type { InAppKind } from "@/types/in-app-notifications"
import { setNotificationChoice } from "../api/actions"
import { notificationMessagesFor } from "../i18n"
import type { InAppChoice } from "../types/notifications"
import { CHOICE_GROUPS } from "../utils/notification-view"

// The owner's choices (docs/plans/in-app-notifications.md, N7): which kinds
// reach this business's bell, one switch each, in two groups. Each switch
// shows its new place at once and saves on its own.
export function NotificationChoices({
  businessId,
  language,
  choices,
}: {
  businessId: string
  language: PageLanguage
  choices: InAppChoice[]
}) {
  const t = notificationMessagesFor(language)
  const [, startTransition] = useTransition()
  const [shown, setShown] = useOptimistic(
    choices,
    (current, change: InAppChoice) =>
      current.map((choice) => (choice.kind === change.kind ? change : choice))
  )
  const on = (kind: InAppKind) =>
    shown.find((choice) => choice.kind === kind)?.on ?? true

  const change = (kind: InAppKind, next: boolean) =>
    startTransition(async () => {
      setShown({ kind, on: next })
      const result = await setNotificationChoice(businessId, kind, next)
      if (!result.ok) toast.error(t.choices.failed)
    })

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t.choices.open}</p>
      <FieldGroup>
        {CHOICE_GROUPS.map((group) => (
          <FieldSet key={group.id}>
            <FieldLegend>{t.choices.groups[group.id]}</FieldLegend>
            <FieldGroup className="gap-3">
              {group.kinds.map((kind) => {
                const id = `notify-${kind}`
                return (
                  <FieldLabel key={kind} htmlFor={id}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{t.choices.names[kind]}</FieldTitle>
                      </FieldContent>
                      <Switch
                        id={id}
                        checked={on(kind)}
                        onCheckedChange={(next) => change(kind, next)}
                      />
                    </Field>
                  </FieldLabel>
                )
              })}
            </FieldGroup>
          </FieldSet>
        ))}
      </FieldGroup>
    </div>
  )
}
