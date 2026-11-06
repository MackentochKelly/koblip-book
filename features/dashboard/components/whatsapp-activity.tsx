"use client"

import Link from "next/link"
import { useLocale, useMessages, useTranslations } from "next-intl"

import { WhatsappActivityList } from "@/components/whatsapp-activity-list"
import { Button } from "@/components/ui/button"
import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type { SendKind } from "@/types/whatsapp"
import { sendAgain } from "../api/notification-actions"
import type { ActivityFilter, NotificationSend } from "../types/notifications"
import type { AutomationRun } from "../types/automations"

const SEND_KINDS: readonly SendKind[] = [...BOOKING_MESSAGES, "thankYou"]

// Each word of a group by its key, for a list that looks them up by a code.
function wordsOf<K extends string>(keys: readonly K[], word: (key: K) => string) {
  return Object.fromEntries(keys.map((key) => [key, word(key)])) as Record<K, string>
}

// The keys of a group of words, as the page has them.
function keysOf<K extends string>(group: Record<K, string>) {
  return Object.keys(group) as K[]
}

// Activity on the business's WhatsApp page (P7): the shared list (D33), in
// the business's time zone, with "Send again" for a failed message, and the
// automation runs among them (D18).
export function WhatsappActivity({
  businessId,
  history,
  runs,
  filter,
  timeZone,
}: {
  businessId: string
  history: NotificationSend[]
  runs: AutomationRun[]
  filter: ActivityFilter
  timeZone: string
}) {
  const t = useTranslations("owner.whatsapp")
  const locale = useLocale()
  const words = useMessages().owner.whatsapp
  return (
    <WhatsappActivityList
      rows={history}
      runs={runs}
      filter={filter}
      timeZone={timeZone}
      labels={{
        locale,
        names: wordsOf(SEND_KINDS, (key) => t(`names.${key}`)),
        noHistory: t("noHistory"),
        search: t("search"),
        searchLabel: t("searchLabel"),
        messageFilter: t("messageFilter"),
        stateFilter: t("stateFilter"),
        filters: t("filters"),
        showResults: t("showResults"),
        allMessages: t("allMessages"),
        allStates: t("allStates"),
        noneFound: t("noneFound"),
        clearFilters: t("clearFilters"),
        via: { text: t("via.text"), template: t("via.template") },
        replies: {
          confirm: t("replies.confirm"),
          cantCome: t("replies.cantCome"),
          ok: t("replies.ok"),
        },
        states: wordsOf(keysOf(words.states), (key) => t(`states.${key}`)),
        reasons: wordsOf(keysOf(words.reasons), (key) => t(`reasons.${key}`)),
        sendAgain: t("sendAgain"),
        sendAgainLabel: (name) => t("sendAgainLabel", { name }),
        sentAgain: t("sentAgain"),
        sendAgainFailed: t("sendAgainFailed"),
        sendAgainProblems: wordsOf(keysOf(words.sendAgainProblems), (key) => t(`sendAgainProblems.${key}`)),
        automations: {
          filter: t("automations.filter"),
          steps: wordsOf(keysOf(words.automations.steps), (key) => t(`automations.steps.${key}`)),
        },
      }}
      onSendAgain={(id) => sendAgain(businessId, id)}
      // Nothing sent yet: the Overview's test shows what customers get.
      emptyAction={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/dashboard/${businessId}/automations#test`} />}
        >
          {t("sendATest")}
        </Button>
      }
    />
  )
}
