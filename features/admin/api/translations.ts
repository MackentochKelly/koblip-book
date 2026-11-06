import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  like,
  or,
  sql,
} from "drizzle-orm"
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  businesses,
  platformSettingChanges,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import { getTranslator } from "@/lib/translations/provider"
import {
  GOOGLE_FREE_MONTHLY_CHARACTERS,
  TRANSLATION_ADMIN_HISTORY_ROWS,
  TRANSLATION_ADMIN_PAGE_ROWS,
  TRANSLATION_STATUSES,
  type TranslationAction,
  type TranslationOrigin,
  type TranslationRuleKey,
  type TranslationScope,
  type TranslationStatus,
} from "@/lib/translations/rules"
import {
  isTranslationRuleKey,
  translationRuleSettings,
} from "@/lib/translations/settings"
import type { TranslationFilter } from "../utils/translation-filter"

// Admin → Translations (docs/plans/translations.md, G5): every translated
// text, read after the admin check.

export interface TranslationRow {
  id: string
  scope: TranslationScope
  // Business: the kind of text ("service.name"). Interface: the page.
  module: string
  key: string
  language: string
  sourceText: string
  text: string | null
  status: TranslationStatus
  origin: TranslationOrigin | null
  businessId: string | null
  businessName: string | null
  updatedAt: string
}

const rowColumns = {
  id: translationEntries.id,
  scope: translationEntries.scope,
  module: translationEntries.module,
  key: translationEntries.key,
  language: translationEntries.language,
  sourceText: translationEntries.sourceText,
  text: translationEntries.text,
  status: translationEntries.status,
  origin: translationEntries.origin,
  businessId: translationEntries.businessId,
  businessName: businesses.name,
  updatedAt: translationEntries.updatedAt,
}

// What needs an admin first: failed, then needs review, then waiting.
const attentionFirst = sql`case ${translationEntries.status}
  when 'failed' then 0 when 'needs_review' then 1 when 'pending' then 2
  else 3 end`

// A search for the words as typed, in the English, the translation or the
// key (`%` and `_` are not wildcards).
function contains(column: AnySQLiteColumn, search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
  return sql`${column} like ${pattern} escape '\\'`
}

function listWhere(scope: TranslationScope, filter: TranslationFilter) {
  return and(
    eq(translationEntries.scope, scope),
    filter.language ? eq(translationEntries.language, filter.language) : undefined,
    filter.state ? eq(translationEntries.status, filter.state) : undefined,
    filter.group
      ? scope === "business"
        ? eq(translationEntries.businessId, filter.group)
        : eq(translationEntries.module, filter.group)
      : undefined,
    filter.search
      ? or(
          contains(translationEntries.sourceText, filter.search),
          contains(translationEntries.text, filter.search),
          contains(translationEntries.key, filter.search)
        )
      : undefined
  )
}

export interface TranslationList {
  rows: TranslationRow[]
  total: number
  // The page shown (a page past the end shows the last one), from 1.
  page: number
  pages: number
}

// One page of a kind of texts, filtered, what needs an admin first.
export async function getTranslationList(
  scope: TranslationScope,
  filter: TranslationFilter
): Promise<TranslationList> {
  await requireAdmin()
  const where = listWhere(scope, filter)
  const [{ total }] = await db
    .select({ total: count() })
    .from(translationEntries)
    .where(where)
  const pages = Math.max(1, Math.ceil(total / TRANSLATION_ADMIN_PAGE_ROWS))
  const page = Math.min(filter.page, pages)
  const rows = await db
    .select(rowColumns)
    .from(translationEntries)
    .leftJoin(businesses, eq(businesses.id, translationEntries.businessId))
    .where(where)
    .orderBy(attentionFirst, desc(translationEntries.updatedAt), asc(translationEntries.id))
    .limit(TRANSLATION_ADMIN_PAGE_ROWS)
    .offset((page - 1) * TRANSLATION_ADMIN_PAGE_ROWS)
  return { rows, total, page, pages }
}

// The businesses (Business texts) or pages (Interface) that have texts, for
// the list's filter.
export async function getTranslationGroups(
  scope: TranslationScope
): Promise<{ id: string; label: string }[]> {
  await requireAdmin()
  if (scope === "business") {
    const rows = await db
      .selectDistinct({ id: businesses.id, label: businesses.name })
      .from(translationEntries)
      .innerJoin(businesses, eq(businesses.id, translationEntries.businessId))
      .where(eq(translationEntries.scope, "business"))
      .orderBy(asc(businesses.name))
    return rows
  }
  const rows = await db
    .selectDistinct({ id: translationEntries.module })
    .from(translationEntries)
    .where(eq(translationEntries.scope, "interface"))
    .orderBy(asc(translationEntries.module))
  return rows.map((row) => ({ id: row.id, label: row.id }))
}

export interface TranslationOverview {
  // Who translates now: Google, the test translator, or nobody yet (G0).
  translator: "google" | "fake" | null
  // Characters sent to Google since the 1st of this month (UTC).
  monthCharacters: number
  freeCharacters: number
  counts: Record<TranslationScope, Record<TranslationStatus, number>>
}

export async function getTranslationOverview(
  now = new Date()
): Promise<TranslationOverview> {
  await requireAdmin()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString()
  const [rows, [month]] = await Promise.all([
    db
      .select({
        scope: translationEntries.scope,
        status: translationEntries.status,
        total: count(),
      })
      .from(translationEntries)
      .groupBy(translationEntries.scope, translationEntries.status),
    db
      .select({
        characters: sql<number>`coalesce(sum(${translationHistory.characters}), 0)`,
      })
      .from(translationHistory)
      .where(gte(translationHistory.changedAt, monthStart)),
  ])
  const none = () =>
    Object.fromEntries(TRANSLATION_STATUSES.map((status) => [status, 0])) as Record<
      TranslationStatus,
      number
    >
  const counts = { interface: none(), business: none() }
  for (const row of rows) counts[row.scope][row.status] = row.total
  return {
    translator: getTranslator()?.name ?? null,
    monthCharacters: Number(month.characters),
    freeCharacters: GOOGLE_FREE_MONTHLY_CHARACTERS,
    counts,
  }
}

export interface TranslationHistoryRow {
  id: number
  action: TranslationAction
  sourceText: string
  before: string | null
  after: string | null
  characters: number
  // Null for Google's own work, or once the admin's account is gone.
  changedBy: string | null
  changedAt: string
}

export interface TranslationDetail {
  entry: TranslationRow & {
    attempts: number
    nextAttemptAt: string | null
    lastError: string | null
  }
  history: TranslationHistoryRow[]
}

const historyColumns = {
  id: translationHistory.id,
  action: translationHistory.action,
  sourceText: translationHistory.sourceText,
  before: translationHistory.before,
  after: translationHistory.after,
  characters: translationHistory.characters,
  changedBy: user.name,
  changedAt: translationHistory.changedAt,
}

// One text with everything that happened to it, newest first; null when it
// is gone or of another kind.
export async function getTranslationDetail(
  scope: TranslationScope,
  id: string
): Promise<TranslationDetail | null> {
  await requireAdmin()
  const [entry] = await db
    .select({
      ...rowColumns,
      attempts: translationEntries.attempts,
      nextAttemptAt: translationEntries.nextAttemptAt,
      lastError: translationEntries.lastError,
    })
    .from(translationEntries)
    .leftJoin(businesses, eq(businesses.id, translationEntries.businessId))
    .where(and(eq(translationEntries.id, id), eq(translationEntries.scope, scope)))
  if (!entry) return null
  const history = await db
    .select(historyColumns)
    .from(translationHistory)
    .leftJoin(user, eq(user.id, translationHistory.changedBy))
    .where(eq(translationHistory.entryId, id))
    .orderBy(desc(translationHistory.id))
    .limit(TRANSLATION_ADMIN_HISTORY_ROWS)
  return { entry, history }
}

export type TranslationChange =
  | (TranslationHistoryRow & {
      kind: "text"
      // Null once the text itself is gone.
      entryId: string | null
      scope: TranslationScope
      key: string
      language: string
      businessName: string | null
    })
  | {
      kind: "rule"
      id: number
      rule: TranslationRuleKey
      before: unknown
      after: unknown
      changedBy: string | null
      changedAt: string
    }

// Admin → Translations → History: what happened to every text (Google's
// work, changes in the English, admins' edits) and every change to the
// rules, newest first.
export async function getTranslationChanges(): Promise<TranslationChange[]> {
  await requireAdmin()
  const [texts, rules] = await Promise.all([
    db
      .select({
        ...historyColumns,
        entryId: translationHistory.entryId,
        scope: translationHistory.scope,
        key: translationHistory.key,
        language: translationHistory.language,
        businessName: businesses.name,
      })
      .from(translationHistory)
      .leftJoin(user, eq(user.id, translationHistory.changedBy))
      .leftJoin(businesses, eq(businesses.id, translationHistory.businessId))
      .orderBy(desc(translationHistory.changedAt), desc(translationHistory.id))
      .limit(TRANSLATION_ADMIN_HISTORY_ROWS),
    db
      .select({
        id: platformSettingChanges.id,
        key: platformSettingChanges.key,
        before: platformSettingChanges.before,
        after: platformSettingChanges.after,
        changedBy: user.name,
        changedAt: platformSettingChanges.changedAt,
      })
      .from(platformSettingChanges)
      .leftJoin(user, eq(user.id, platformSettingChanges.changedBy))
      .where(like(platformSettingChanges.key, "translation.%"))
      .orderBy(desc(platformSettingChanges.id))
      .limit(TRANSLATION_ADMIN_HISTORY_ROWS),
  ])
  const changes: TranslationChange[] = [
    ...texts.map((row) => ({ ...row, kind: "text" as const })),
    ...rules.flatMap((row) => {
      const rule = row.key.slice("translation.".length)
      return isTranslationRuleKey(rule)
        ? [{ ...row, kind: "rule" as const, rule }]
        : []
    }),
  ]
  return changes
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .slice(0, TRANSLATION_ADMIN_HISTORY_ROWS)
}

// Admin → Translations → Rules.
export async function getTranslationRules() {
  await requireAdmin()
  return translationRuleSettings()
}
