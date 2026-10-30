"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { PHONE_PATTERN } from "@/lib/booking-rules"
import { saveNotificationSettings } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { NotificationMessage, NotificationSettings } from "../types/notifications"
import type { EditorLimits } from "./message-editor"
import { isCustomerMessage, WhatsappMessageList } from "./whatsapp-message-list"

// Your alerts: the messages to the owner's own WhatsApp, and that number.
export function WhatsappAlerts({
  businessId,
  messages,
  settings,
  limits,
}: {
  businessId: string
  messages: NotificationMessage[]
  settings: NotificationSettings
  limits: EditorLimits
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const [phone, setPhone] = useState(settings.ownerPhone ?? "")
  const [badPhone, setBadPhone] = useState(false)
  const [pending, startTransition] = useTransition()

  const save = () => {
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
      setBadPhone(true)
      return
    }
    setBadPhone(false)
    startTransition(async () => {
      const result = await saveNotificationSettings(businessId, {
        ownerPhone: phone.trim() || null,
        // The owner's alert goes in the language they use Book in.
        ownerLanguage: m.locale.startsWith("es") ? "es" : "en",
        reminders: settings.reminders,
        quietStart: settings.quietStart,
        quietEnd: settings.quietEnd,
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
      <WhatsappMessageList
        businessId={businessId}
        limits={limits}
        messages={messages.filter((item) => !isCustomerMessage(item.message))}
      />

      <PageSection id="your-number" title={t.yourNumber}>
        <Field data-invalid={badPhone || undefined}>
          <FieldLabel htmlFor="owner-whatsapp" className="sr-only">
            {t.yourNumber}
          </FieldLabel>
          <Input
            id="owner-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 809 555 0000"
            value={phone}
            aria-invalid={badPhone || undefined}
            onChange={(event) => setPhone(event.target.value)}
          />
          {badPhone ? (
            <FieldError>{t.badPhone}</FieldError>
          ) : (
            <FieldDescription>{t.yourNumberHint}</FieldDescription>
          )}
        </Field>
        <Button size="lg" onClick={save} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {t.saveSettings}
        </Button>
      </PageSection>
    </div>
  )
}
