"use client"

import Link from "next/link"
import { useOptimistic, useTransition } from "react"
import { useLocale, useMessages, useTranslations } from "next-intl"
import { toast } from "sonner"

import { EmailActivityList } from "@/components/email-activity-list"
import { PageSection } from "@/components/page-section"
import { SwitchGroups } from "@/components/switch-groups"
import { Button } from "@/components/ui/button"
import {
  BOOKING_EMAILS,
  CUSTOMER_EMAILS,
  OWNER_EMAILS,
  type BookingEmail,
} from "@/lib/email-rules"
import type { EmailActivityFilter, EmailActivityRow } from "@/types/email"
import { setEmailOn } from "../api/notification-actions"

// Each word of a group by its key.
function wordsOf<K extends string>(keys: readonly K[], word: (key: K) => string) {
  return Object.fromEntries(keys.map((key) => [key, word(key)])) as Record<K, string>
}

function keysOf<K extends string>(group: Record<K, string>) {
  return Object.keys(group) as K[]
}

const GROUPS = [
  { id: "customer", kinds: CUSTOMER_EMAILS },
  { id: "owner", kinds: OWNER_EMAILS },
] as const

// The owner's Email page (docs/plans/email.md, EM-10): one switch per
// booking email, then the history of what went, waits or was not sent.
export function EmailPage({
  businessId,
  turnedOff,
  history,
  filter,
  timeZone,
}: {
  businessId: string
  turnedOff: BookingEmail[]
  history: EmailActivityRow[]
  filter: EmailActivityFilter
  timeZone: string
}) {
  const t = useTranslations("owner.email")
  const locale = useLocale()
  const words = useMessages().owner.email
  const [, startTransition] = useTransition()
  const [off, setOff] = useOptimistic(turnedOff, (current, change: { kind: BookingEmail; on: boolean }) =>
    change.on ? current.filter((kind) => kind !== change.kind) : [...current, change.kind]
  )

  const change = (kind: BookingEmail, on: boolean) =>
    startTransition(async () => {
      setOff({ kind, on })
      const result = await setEmailOn(businessId, kind, on).catch(() => null)
      if (!result?.ok) toast.error(t("failed"))
    })

  return (
    <div className="flex flex-col gap-8">
      <PageSection id="emails" title={t("emails")}>
        <SwitchGroups<BookingEmail>
          idPrefix="email"
          moreInfo={t("moreInfo")}
          onChange={change}
          groups={GROUPS.map((group) => ({
            id: group.id,
            title: t(`groups.${group.id}`),
            about: t(`about.${group.id}`),
            items: group.kinds.map((kind) => ({
              key: kind,
              name: t(`names.${kind}`),
              on: !off.includes(kind),
            })),
          }))}
        />
      </PageSection>

      <PageSection id="history" title={t("history")}>
        <EmailActivityList
          rows={history}
          kinds={BOOKING_EMAILS}
          filter={filter}
          timeZone={timeZone}
          labels={{
            locale,
            names: wordsOf(BOOKING_EMAILS, (kind) => t(`names.${kind}`)),
            noHistory: t("noHistory"),
            search: t("search"),
            searchLabel: t("searchLabel"),
            emailFilter: t("emailFilter"),
            stateFilter: t("stateFilter"),
            filters: t("filters"),
            showResults: t("showResults"),
            allEmails: t("allEmails"),
            allStates: t("allStates"),
            noneFound: t("noneFound"),
            clearFilters: t("clearFilters"),
            states: wordsOf(keysOf(words.states), (key) => t(`states.${key}`)),
            reasons: wordsOf(keysOf(words.reasons), (key) => t(`reasons.${key}`)),
          }}
          emptyAction={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/${businessId}/bookings`} />}
            >
              {t("openBookings")}
            </Button>
          }
        />
      </PageSection>
    </div>
  )
}
