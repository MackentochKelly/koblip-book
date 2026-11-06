"use client"

import { useTranslations } from "next-intl"
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
import { InfoTip } from "@/components/info-tip"
import { PageSection } from "@/components/page-section"
import { Switch } from "@/components/ui/switch"
import type { InAppKind } from "@/types/in-app-notifications"
import { setNotificationChoice } from "../api/actions"
import type { InAppChoice } from "../types/notifications"
import { CHOICE_GROUPS } from "../utils/notification-view"

// The owner's choices (docs/plans/in-app-notifications.md, N7): which kinds
// reach this business's bell, one switch each, in two groups. Each switch
// shows its new place at once and saves on its own.
export function NotificationChoices({
  businessId,
  choices,
}: {
  businessId: string
  choices: InAppChoice[]
}) {
  const t = useTranslations("notifications.choices")
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
      if (!result.ok) toast.error(t("failed"))
    })

  return (
    <PageSection id="notifications" title={t("title")}>
      <FieldGroup>
        {CHOICE_GROUPS.map((group) => (
          <FieldSet key={group.id}>
            {/* The ⓘ keeps the name's line height (32px button, 24px line). */}
            <FieldLegend className="flex items-center gap-1">
              {t(`groups.${group.id}`)}
              <InfoTip label={t("moreInfo")} className="-my-1">
                {t(`about.${group.id}`)}
              </InfoTip>
            </FieldLegend>
            <FieldGroup className="gap-3">
              {group.kinds.map((kind) => {
                const id = `notify-${kind}`
                return (
                  <FieldLabel key={kind} htmlFor={id}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{t(`names.${kind}`)}</FieldTitle>
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
    </PageSection>
  )
}
