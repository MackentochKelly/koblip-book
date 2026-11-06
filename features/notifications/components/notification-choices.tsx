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
import { AppSelect } from "@/components/app-select"
import { InfoTip } from "@/components/info-tip"
import { ClockIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { PageSection } from "@/components/page-section"
import { Switch } from "@/components/ui/switch"
import type {
  ClientInAppKind,
  InAppKind,
  OwnerInAppKind,
} from "@/types/in-app-notifications"
import { CLIENT_REMINDER_CHANNELS } from "@/lib/client-reminder-channels"
import { setNotificationChoice } from "../api/actions"
import {
  setClientNotificationChoice,
  setClientReminderChannel,
} from "../api/client-actions"
import type {
  ClientReminderChoice,
  InAppChoice,
  InAppChoiceResult,
} from "../types/notifications"
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

// The client's, in their account's Settings: first how their reminders
// reach them (D16), then the bell's switches.
export function ClientNotificationChoices({
  choices,
  reminder,
}: {
  choices: InAppChoice[]
  reminder: ClientReminderChoice
}) {
  return (
    <ChoiceSwitches<ClientInAppKind>
      groups={CLIENT_CHOICE_GROUPS}
      choices={choices}
      save={setClientNotificationChoice}
      lead={<ReminderChannel choice={reminder} />}
    />
  )
}

// "Remind me by": WhatsApp, email (only with an email) or this bell only.
// Shows the new pick at once and saves it.
function ReminderChannel({ choice }: { choice: ClientReminderChoice }) {
  const t = useTranslations("notifications.choices")
  const [, startTransition] = useTransition()
  const [channel, setChannel] = useOptimistic(choice.channel)
  const help =
    channel === "email" && choice.email
      ? t("channelHelp.email", { email: choice.email })
      : t(`channelHelp.${channel === "email" ? "bell" : channel}`)
  return (
    <Item variant="box">
      <ItemMedia variant="icon">
        <ClockIcon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{t("remindBy")}</ItemTitle>
        <ItemDescription className="truncate">{help}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <AppSelect
          aria-label={t("remindBy")}
          value={channel}
          onValueChange={(next) =>
            startTransition(async () => {
              setChannel(next)
              const result = await setClientReminderChannel(next)
              if (!result.ok) toast.error(t("failed"))
            })
          }
          options={CLIENT_REMINDER_CHANNELS.map((value) => ({
            value,
            label: t(`channels.${value}`),
            disabled: value === "email" && !choice.email,
            description:
              value === "email" && !choice.email ? t("noEmail") : undefined,
          }))}
        />
      </ItemActions>
    </Item>
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
  lead,
}: {
  groups: readonly ChoiceGroup<Kind>[]
  choices: InAppChoice[]
  save: (kind: Kind, on: boolean) => Promise<InAppChoiceResult>
  // A choice before the groups.
  lead?: React.ReactNode
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
        {lead}
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
