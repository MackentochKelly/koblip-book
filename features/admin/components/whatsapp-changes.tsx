import { useLocale, useTranslations } from "next-intl"

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { SquarePenIcon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { useFormatDuration } from "@/hooks/use-format-duration"
import {
  NOTIFICATION_RULES,
  type NotificationRuleKey,
} from "@/lib/notification-rules"
import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type { WhatsappChange } from "../api/whatsapp-changes"
import { formatRuleValue, type RuleWords } from "../utils/rule-values"

type Words = ReturnType<typeof useTranslations<"admin.whatsapp">>

const isRule = (key: string): key is NotificationRuleKey =>
  Object.hasOwn(NOTIFICATION_RULES, key)

// What changed and how, in words: a rule from → to (null is its default), or
// one of a business's changes (lib/platform-settings.ts, adminChangeEntry).
function describe(
  change: WhatsappChange,
  t: Words,
  rules: RuleWords,
  locale: string,
  formatDuration: (minutes: number) => string
) {
  const messageName = (value: unknown) => {
    const message = BOOKING_MESSAGES.find((item) => item === value)
    return message ? t(`messages.${message}`) : String(value)
  }
  const languageName = (language: string | undefined) =>
    language === "es"
      ? t("koblipMessages.spanish")
      : language === "en"
        ? t("koblipMessages.english")
        : null
  if (isRule(change.key)) {
    const key = change.key
    const value = (v: unknown) =>
      v === null || v === undefined
        ? `${t("changes.defaultValue")} (${formatRuleValue(key, NOTIFICATION_RULES[key], rules, locale, formatDuration)})`
        : formatRuleValue(key, v, rules, locale, formatDuration)
    return {
      title: rules(`names.${key}`),
      detail: `${value(change.before)} → ${value(change.after)}`,
    }
  }
  if (change.key === "whatsapp.turnedOff") {
    const list = (v: unknown) =>
      Array.isArray(v) && v.length
        ? v.map(messageName).join(", ")
        : t("changes.noneOff")
    return {
      title: t("changes.turnedOff"),
      detail: `${list(change.before)} → ${list(change.after)}`,
    }
  }
  if (change.key === "whatsapp.settings")
    return { title: t("changes.settings"), detail: null }
  if (change.key === "whatsapp.connection") {
    return {
      title: t("changes.connection"),
      detail: `${String(change.before)} → ${t("changes.removed")}`,
    }
  }
  if (change.key.startsWith("whatsapp.wording.")) {
    return {
      title: t("changes.wording", {
        message: messageName(change.key.slice("whatsapp.wording.".length)),
      }),
      detail: null,
    }
  }
  if (change.key.startsWith("whatsapp.koblipWording.")) {
    const [message, language] = change.key.slice("whatsapp.koblipWording.".length).split(".")
    return {
      title: t("changes.koblipWording", { message: messageName(message) }),
      detail: languageName(language),
    }
  }
  if (change.key.startsWith("whatsapp.koblipSubmit.")) {
    const [message, language] = change.key.slice("whatsapp.koblipSubmit.".length).split(".")
    return {
      title: t("changes.koblipSubmit", { message: messageName(message) }),
      detail: languageName(language),
    }
  }
  return { title: change.key, detail: null }
}

// WhatsApp → Change log (A7): every admin change, newest first: what, how,
// for whom, who and when.
export function WhatsappChanges({ changes }: { changes: WhatsappChange[] }) {
  const t = useTranslations("admin.whatsapp")
  const rules = useTranslations("admin.whatsapp.rules")
  const locale = useLocale()
  const formatDuration = useFormatDuration()
  if (!changes.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquarePenIcon />
          </EmptyMedia>
          <EmptyTitle>{t("changes.none")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  return (
    <ItemGroup className="gap-3">
      {changes.map((change) => {
        const { title, detail } = describe(change, t, rules, locale, formatDuration)
        return (
          <Item key={change.id} variant="outline">
            <ItemContent className="min-w-0">
              <ItemTitle>{title}</ItemTitle>
              {detail && (
                <ItemDescription className="break-words">
                  {detail}
                </ItemDescription>
              )}
              <ItemDescription className="truncate">
                {[
                  change.businessName ?? t("changes.everyone"),
                  change.changedBy ?? t("changes.someone"),
                  when.format(new Date(change.changedAt)),
                ].join(" · ")}
              </ItemDescription>
            </ItemContent>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
