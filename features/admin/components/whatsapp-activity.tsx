"use client"

import Link from "next/link"
import { useLocale, useMessages, useTranslations } from "next-intl"

import {
  WhatsappActivityList,
  type ActivityLabels,
} from "@/components/whatsapp-activity-list"
import { Button } from "@/components/ui/button"
import type { ActivityFilter, ActivityRun, BusinessNotificationSend } from "@/types/whatsapp"
import { adminCancelSend, adminSendAgain } from "../api/whatsapp-activity-actions"
import { wordGroup } from "../utils/word-group"
import { WHATSAPP_BASE } from "../utils/whatsapp-parts"

// WhatsApp → Activity (A5): the business page's list (D33) for every
// business, each row with its business and in its time zone; a failed
// message can be sent again and a waiting one cancelled. Automation runs
// show among the messages.
export function WhatsappActivity({
  rows,
  runs,
  filter,
}: {
  rows: BusinessNotificationSend[]
  runs: ActivityRun[]
  filter: ActivityFilter
}) {
  const t = useTranslations("admin.whatsapp.activity")
  const words = useMessages().admin.whatsapp.activity
  const locale = useLocale()
  const labels: ActivityLabels = {
    locale,
    names: wordGroup(words.names, (key) => t(`names.${key}`)),
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
    via: wordGroup(words.via, (key) => t(`via.${key}`)),
    replies: wordGroup(words.replies, (key) => t(`replies.${key}`)),
    states: wordGroup(words.states, (key) => t(`states.${key}`)),
    reasons: wordGroup(words.reasons, (key) => t(`reasons.${key}`)),
    sendAgain: t("sendAgain"),
    sendAgainLabel: (name) => t("sendAgainLabel", { name }),
    sentAgain: t("sentAgain"),
    sendAgainFailed: t("sendAgainFailed"),
    sendAgainProblems: wordGroup(
      words.sendAgainProblems,
      (key) => t(`sendAgainProblems.${key}`)
    ),
    automations: {
      filter: t("automations.filter"),
      steps: wordGroup(
        words.automations.steps,
        (key) => t(`automations.steps.${key}`)
      ),
    },
    cancelSend: {
      label: (name) => t("cancelSend.label", { name }),
      title: t("cancelSend.title"),
      text: t("cancelSend.text"),
      confirm: t("cancelSend.confirm"),
      keep: t("cancelSend.keep"),
      done: t("cancelSend.done"),
      failed: t("cancelSend.failed"),
      problems: wordGroup(
        words.cancelSend.problems,
        (key) => t(`cancelSend.problems.${key}`)
      ),
    },
  }
  return (
    <WhatsappActivityList
      rows={rows}
      runs={runs}
      filter={filter}
      labels={labels}
      showBusiness
      onSendAgain={adminSendAgain}
      onCancel={adminCancelSend}
      emptyAction={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`${WHATSAPP_BASE}/businesses`} />}
        >
          {t("seeBusinesses")}
        </Button>
      }
    />
  )
}
