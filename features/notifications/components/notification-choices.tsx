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
import type {
  ClientInAppKind,
  InAppKind,
  OwnerInAppKind,
} from "@/types/in-app-notifications"
import { setNotificationChoice } from "../api/actions"
import { setClientNotificationChoice } from "../api/client-actions"
import type { InAppChoice, InAppChoiceResult } from "../types/notifications"
import {
  CHOICE_GROUPS,
  CLIENT_CHOICE_GROUPS,
  type ChoiceGroup,
} from "../utils/notification-view"

// The owner's choices for one business (N7).
export function NotificationChoices({
  businessId,
  choices,
}: {
  businessId: string
  choices: InAppChoice[]
}) {
  return (
    <ChoiceSwitches<OwnerInAppKind>
      groups={CHOICE_GROUPS}
      choices={choices}
      save={(kind, on) => setNotificationChoice(businessId, kind, on)}
    />
  )
}

// The client's, in their account's Settings.
export function ClientNotificationChoices({
  choices,
}: {
  choices: InAppChoice[]
}) {
  return (
    <ChoiceSwitches<ClientInAppKind>
      groups={CLIENT_CHOICE_GROUPS}
      choices={choices}
      save={setClientNotificationChoice}
    />
  )
}

// Which kinds reach a bell, one switch each, in groups: the owner's for one
// business (docs/plans/in-app-notifications.md, N7) or the client's
// (docs/plans/client-account.md, D10). Each switch shows its new place at
// once and saves on its own with `save`.
function ChoiceSwitches<Kind extends InAppKind>({
  groups,
  choices,
  save,
}: {
  groups: readonly ChoiceGroup<Kind>[]
  choices: InAppChoice[]
  save: (kind: Kind, on: boolean) => Promise<InAppChoiceResult>
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

  const change = (kind: Kind, next: boolean) =>
    startTransition(async () => {
      setShown({ kind, on: next })
      const result = await save(kind, next)
      if (!result.ok) toast.error(t("failed"))
    })

  return (
    <PageSection id="notifications" title={t("title")}>
      <FieldGroup>
        {groups.map((group) => (
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
                const name: InAppKind = kind
                const id = `notify-${kind}`
                return (
                  <FieldLabel key={kind} htmlFor={id}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{t(`names.${name}`)}</FieldTitle>
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
