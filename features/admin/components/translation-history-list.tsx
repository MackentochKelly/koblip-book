"use client"

import Link from "next/link"

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
import type { TranslationScope } from "@/lib/translations/rules"
import type {
  TranslationChange,
  TranslationHistoryRow,
} from "../api/translations"
import { useAdminMessages } from "../i18n/provider"
import { textLabels } from "../utils/translation-labels"
import { translationEntryHref } from "../utils/translation-parts"
import { formatTranslationRule } from "../utils/translation-rule-values"

// One text's history (on its own screen) or every change (History): rows
// with the text they belong to, and rule changes, newest first.
export type HistoryListRow =
  | (TranslationHistoryRow & { kind: "text" })
  | TranslationChange

// What happened, by whom (Google's own work says so), when, and the
// characters Google billed. With `showText`, each text's row names the text
// and opens it.
export function TranslationHistoryList({
  rows,
  showText,
}: {
  rows: HistoryListRow[]
  showText: boolean
}) {
  const m = useAdminMessages()
  const t = m.translations
  const number = new Intl.NumberFormat(m.locale)
  const when = new Intl.DateTimeFormat(m.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  if (rows.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquarePenIcon />
          </EmptyMedia>
          <EmptyTitle>{t.history.none}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  const ruleValue = (row: Extract<TranslationChange, { kind: "rule" }>, value: unknown) =>
    value === null || value === undefined
      ? t.history.defaultValue
      : formatTranslationRule(row.rule, value, m)

  return (
    <ItemGroup className="gap-2">
      {rows.map((row) => {
        if (row.kind === "rule") {
          return (
            <Item key={`rule-${row.id}`} variant="outline" size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle>{t.rules.names[row.rule]}</ItemTitle>
                <ItemDescription className="break-words">
                  {`${ruleValue(row, row.before)} → ${ruleValue(row, row.after)}`}
                </ItemDescription>
                <ItemDescription className="truncate">
                  {[
                    row.changedBy ?? t.history.someone,
                    when.format(new Date(row.changedAt)),
                  ].join(" · ")}
                </ItemDescription>
              </ItemContent>
            </Item>
          )
        }
        const byGoogle =
          row.action === "google" || row.action === "memory" || row.action === "failed"
        const who = row.changedBy ?? (byGoogle ? t.history.google : null)
        const context = "scope" in row && showText ? contextOf(row) : null
        const meta = [
          context,
          who,
          when.format(new Date(row.changedAt)),
          row.characters > 0 ? t.history.characters(number.format(row.characters)) : null,
        ]
          .filter(Boolean)
          .join(" · ")
        const href =
          showText && "entryId" in row && row.entryId
            ? translationEntryHref(row.scope as TranslationScope, row.entryId)
            : null
        const content = (
          <ItemContent className="min-w-0">
            <ItemTitle>{t.actions[row.action]}</ItemTitle>
            {(row.after ?? (showText ? row.sourceText : null)) && (
              <ItemDescription className="line-clamp-2 break-words">
                {row.after ?? row.sourceText}
              </ItemDescription>
            )}
            <ItemDescription className="truncate">{meta}</ItemDescription>
          </ItemContent>
        )
        return href ? (
          <Item
            key={`text-${row.id}`}
            variant="outline"
            size="sm"
            render={<Link href={href} />}
          >
            {content}
          </Item>
        ) : (
          <Item key={`text-${row.id}`} variant="outline" size="sm">
            {content}
          </Item>
        )
      })}
    </ItemGroup>
  )

  // The text a change belongs to: its business and kind of text (or the
  // interface's word) and language.
  function contextOf(row: Extract<TranslationChange, { kind: "text" }>) {
    const separator = row.key.indexOf(":")
    const labels = textLabels(
      {
        scope: row.scope,
        module: row.scope === "business" ? row.key.slice(separator + 1) : "",
        key: row.key,
        language: row.language,
        businessName: row.businessName,
      },
      m
    )
    return row.scope === "business"
      ? [labels.where, labels.what, labels.language].join(" · ")
      : [t.history.app, labels.what, labels.language].join(" · ")
  }
}
