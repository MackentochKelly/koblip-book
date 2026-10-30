"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { saveNotificationSettings } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { CantComeAction, NotificationSettings } from "../types/notifications"

// Only alerting comes first: it is the default (D2).
const CANT_COME_ACTIONS: readonly CantComeAction[] = ["alertOnly", "cancel"]

// Replies: what "Can't make it" does (cancel and free the time, or only
// alert the owner, D2) and whether the customer gets a thank-you, saved
// together with the rest of the settings as they are.
export function WhatsappReplies({
  businessId,
  settings,
}: {
  businessId: string
  settings: NotificationSettings
}) {
  const t = useOwnerMessages().whatsapp
  const router = useRouter()
  const [cantCome, setCantCome] = useState(settings.cantCome)
  const [thankYou, setThankYou] = useState(settings.thankYouReply)
  const [pending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const result = await saveNotificationSettings(businessId, {
        ownerPhone: settings.ownerPhone,
        ownerLanguage: settings.ownerLanguage,
        reminders: settings.reminders,
        quietStart: settings.quietStart,
        quietEnd: settings.quietEnd,
        cantCome,
        thankYouReply: thankYou,
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
      <PageSection id="cant-come" title={t.replies.cantCome}>
        <RadioGroup
          value={cantCome}
          onValueChange={(next) => setCantCome(next as CantComeAction)}
          aria-label={t.replies.cantCome}
        >
          {CANT_COME_ACTIONS.map((action) => (
            <FieldLabel key={action} htmlFor={`cant-come-${action}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{t.cantComeActions[action]}</FieldTitle>
                  <FieldDescription>{t.cantComeHints[action]}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={action} id={`cant-come-${action}`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </PageSection>

      <PageSection id="thank-you" title={t.names.thankYou}>
        {/* The whole row is the switch's tap area. */}
        <FieldLabel htmlFor="thank-you-reply">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>{t.thankYouLabel}</FieldTitle>
            </FieldContent>
            <Switch id="thank-you-reply" checked={thankYou} onCheckedChange={setThankYou} />
          </Field>
        </FieldLabel>
      </PageSection>

      <Button size="lg" onClick={save} disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        {t.saveSettings}
      </Button>
    </div>
  )
}
