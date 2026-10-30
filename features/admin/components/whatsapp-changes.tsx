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
import {
  NOTIFICATION_RULES,
  type NotificationRuleKey,
} from "@/lib/notification-rules"
import type { WhatsappChange } from "../api/whatsapp-changes"
import type { AdminMessages } from "../i18n"
import { formatRuleValue } from "../utils/rule-values"

type Message = keyof AdminMessages["whatsapp"]["messages"]

const isRule = (key: string): key is NotificationRuleKey =>
  Object.hasOwn(NOTIFICATION_RULES, key)

// What changed and how, in words: a rule from → to (null is its default), or
// one of a business's changes (lib/platform-settings.ts, adminChangeEntry).
function describe(change: WhatsappChange, m: AdminMessages) {
  const t = m.whatsapp.changes
  const messageName = (value: unknown) =>
    m.whatsapp.messages[value as Message] ?? String(value)
  if (isRule(change.key)) {
    const key = change.key
    const value = (v: unknown) =>
      v === null || v === undefined
        ? `${t.defaultValue} (${formatRuleValue(key, NOTIFICATION_RULES[key], m)})`
        : formatRuleValue(key, v, m)
    return {
      title: m.whatsapp.rules.names[key],
      detail: `${value(change.before)} → ${value(change.after)}`,
    }
  }
  if (change.key === "whatsapp.turnedOff") {
    const list = (v: unknown) =>
      Array.isArray(v) && v.length ? v.map(messageName).join(", ") : t.noneOff
    return {
      title: t.turnedOff,
      detail: `${list(change.before)} → ${list(change.after)}`,
    }
  }
  if (change.key === "whatsapp.settings")
    return { title: t.settings, detail: null }
  if (change.key === "whatsapp.connection") {
    return {
      title: t.connection,
      detail: `${String(change.before)} → ${t.removed}`,
    }
  }
  if (change.key.startsWith("whatsapp.wording.")) {
    return {
      title: t.wording(
        messageName(change.key.slice("whatsapp.wording.".length))
      ),
      detail: null,
    }
  }
  return { title: change.key, detail: null }
}

// WhatsApp → Change log (A7): every admin change, newest first: what, how,
// for whom, who and when.
export function WhatsappChanges({
  changes,
  m,
}: {
  changes: WhatsappChange[]
  m: AdminMessages
}) {
  const t = m.whatsapp.changes
  if (!changes.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquarePenIcon />
          </EmptyMedia>
          <EmptyTitle>{t.none}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const when = new Intl.DateTimeFormat(m.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  return (
    <ItemGroup className="gap-3">
      {changes.map((change) => {
        const { title, detail } = describe(change, m)
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
                  change.businessName ?? t.everyone,
                  change.changedBy ?? t.someone,
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
