"use client"

import { useLocale, useMessages, useTranslations } from "next-intl"

import { EmailActivityList } from "@/components/email-activity-list"
import { EMAIL_KINDS } from "@/lib/email-rules"
import type { EmailActivityFilter, EmailActivityRow } from "@/types/email"
import { wordGroup } from "../utils/word-group"

// Email → Emails (docs/plans/email.md, EM-11): a business's history list
// for every email, each row with its business and in its time zone.
export function EmailActivity({
  rows,
  filter,
}: {
  rows: EmailActivityRow[]
  filter: EmailActivityFilter
}) {
  const t = useTranslations("admin.email.activity")
  const words = useMessages().admin.email.activity
  const locale = useLocale()
  return (
    <EmailActivityList
      rows={rows}
      kinds={EMAIL_KINDS}
      filter={filter}
      showBusiness
      labels={{
        locale,
        names: wordGroup(words.names, (key) => t(`names.${key}`)),
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
        states: wordGroup(words.states, (key) => t(`states.${key}`)),
        reasons: wordGroup(words.reasons, (key) => t(`reasons.${key}`)),
      }}
    />
  )
}
