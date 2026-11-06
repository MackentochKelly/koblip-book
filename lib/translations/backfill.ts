import "server-only"

import { and, asc, eq, gte, isNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  businesses,
  translationEntries,
  translationHistory,
} from "@/lib/db/schema"
import { runInTurn } from "@/lib/run-in-turn"
import { businessSyncItems, syncBusinessTexts } from "./business-texts"
import { forgetInterfaceWords } from "./interface-words"
import {
  GOOGLE_LANGUAGE_CODES,
  isTranslationLanguage,
  TRANSLATION_LANGUAGES,
  type TranslationLanguage,
} from "./languages"
import { sourceHash } from "./markup"
import type { Translator } from "./provider"
import {
  googleTexts,
  type GoogleTexts,
  historyOf,
  requestBatches,
  reusable,
  reuseSlot,
  type SyncItem,
  type SyncResult,
  turnKey,
  usedToday,
} from "./queue"
import {
  GOOGLE_FREE_MONTHLY_CHARACTERS,
  GOOGLE_NMT_USD_PER_MILLION_CHARACTERS,
  TRANSLATION_RULES,
  type TranslationScope,
} from "./rules"
import { translationRules } from "./settings"

// The backfill (docs/plans/translations.md, G7), only after the owner's go
// on the cost: Google translates again every text Meta made, and the gaps
// are filled. backfillPlan is the dry run: it only reads, and counts the
// characters as the queue bills them. runBackfill is the real run
// (scripts/translations-backfill.ts --go).
//
// - Meta's texts stay on the page until Google's arrives: the backfill
//   sends them itself and replaces each one only while it is still Meta's,
//   from the same English. An admin's edit or a newer English made
//   meanwhile wins.
// - Gaps (waiting, failed, or not in the queue yet) and the test
//   translator's texts simply wait in the normal queue, which the server's
//   timer sends (lib/translations/timer.ts). The backfill doesn't send them
//   itself: a script and the server sending the same waiting texts at once
//   would pay for them twice.
// - Demo businesses are left out: they are never translated.

type Entry = typeof translationEntries.$inferSelect

// What the backfill does with a text: Google replaces Meta's; the test
// translator's and the gaps wait in the queue.
type Kind = "meta" | "fake" | "gap"

interface Candidate {
  kind: Kind
  // The text as it is now; null when it isn't in the queue yet.
  entry: Entry | null
  scope: TranslationScope
  businessId: string | null
  language: string
  // The English Google gets.
  sourceText: string
  sourceHash: string
}

function kindOf(entry: Entry): Kind | null {
  if (entry.status === "automatic" && entry.origin === "meta") return "meta"
  if (entry.status === "automatic" && entry.origin === "fake") return "fake"
  if (entry.status === "pending" || entry.status === "failed") return "gap"
  return null
}

function fromEntry(entry: Entry, kind: Kind): Candidate {
  return {
    kind,
    entry,
    scope: entry.scope,
    businessId: entry.businessId,
    language: entry.language,
    sourceText: entry.sourceText,
    sourceHash: entry.sourceHash,
  }
}

// One business's texts as the queue sees them once they are in line with
// the current English, as a save does (syncTexts in queue.ts): a text not
// in the queue yet, or whose English changed, waits for Google; an edited
// one whose English changed keeps the admin's words and needs review; a
// removed thing's text goes.
function afterSync(
  businessId: string,
  items: SyncItem[],
  entries: Entry[]
): Candidate[] {
  const byKey = new Map(
    entries.map((entry) => [slot(entry.key, entry.language), entry])
  )
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  for (const item of items) {
    if (item.text.trim() === "") continue
    const hash = sourceHash(item.text)
    for (const language of TRANSLATION_LANGUAGES) {
      const key = slot(item.key, language)
      if (seen.has(key)) continue
      seen.add(key)
      const entry = byKey.get(key) ?? null
      if (entry && entry.sourceHash === hash) {
        const kind = kindOf(entry)
        if (kind) candidates.push(fromEntry(entry, kind))
        continue
      }
      if (
        entry &&
        (entry.status === "edited" || entry.status === "needs_review")
      ) {
        continue
      }
      candidates.push({
        kind: "gap",
        entry,
        scope: "business",
        businessId,
        language,
        sourceText: item.text,
        sourceHash: hash,
      })
    }
  }
  return candidates
}

// Every text the backfill would send: the app's own words as they are, and
// each real business's texts as its next save leaves them.
async function collectCandidates(): Promise<Candidate[]> {
  const [entries, live] = await Promise.all([
    db
      .select()
      .from(translationEntries)
      .orderBy(asc(translationEntries.createdAt), asc(translationEntries.id)),
    realBusinesses(),
  ])
  const candidates: Candidate[] = []
  const byBusiness = new Map<string, Entry[]>()
  for (const entry of entries) {
    if (entry.businessId === null) {
      const kind = kindOf(entry)
      if (kind) candidates.push(fromEntry(entry, kind))
      continue
    }
    const list = byBusiness.get(entry.businessId) ?? []
    list.push(entry)
    byBusiness.set(entry.businessId, list)
  }
  for (const businessId of live) {
    const items = await businessSyncItems(businessId)
    if (!items) continue
    candidates.push(
      ...afterSync(businessId, items, byBusiness.get(businessId) ?? [])
    )
  }
  return candidates
}

async function realBusinesses(): Promise<string[]> {
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.isDemo, false))
    .orderBy(asc(businesses.createdAt), asc(businesses.id))
  return rows.map((row) => row.id)
}

// What Google gets for a text, as the queue sends it; null when it can't
// go (a language the app doesn't have, not a valid message, too long): the
// queue fails those at once, free.
function priced(candidate: Candidate): GoogleTexts | null {
  if (!isTranslationLanguage(candidate.language)) return null
  const texts = googleTexts(candidate.scope, candidate.sourceText)
  if (!texts || texts.characters > TRANSLATION_RULES.maxTextCharacters) {
    return null
  }
  return texts
}

export interface BackfillCount {
  texts: number
  // Characters Google bills for them.
  characters: number
}

export interface BackfillPlanRow {
  scope: TranslationScope
  language: string
  // Meta's translations, still shown: Google's replaces each one.
  meta: BackfillCount
  // The test translator's: they wait for Google again.
  fake: BackfillCount
  // Waiting, failed, or not in the queue yet (new or changed English).
  gaps: BackfillCount
  // The same English Google translated before, or sends once for several
  // of Meta's texts: free.
  reused: number
  // Texts that can't go to Google (a language the app doesn't have, not a
  // valid message, too long).
  skipped: number
}

export interface BackfillPlan {
  rows: BackfillPlanRow[]
  texts: number
  characters: number
  // Characters sent to Google since the 1st of this month (UTC), as Admin →
  // Translations counts them.
  monthCharacters: number
  freeCharacters: number
  freeLeft: number
  // Characters past this month's free part, and what they cost.
  paidCharacters: number
  usdPerMillion: number
  estimatedUsd: number
  // Each business sends at most this a day (UTC); the busiest one needs
  // this many days of runs.
  dailyBusinessCharacters: number
  days: number
}

// The dry run: what a backfill would send, by scope and language, and what
// it would cost. It only reads.
export async function backfillPlan(now = new Date()): Promise<BackfillPlan> {
  const [candidates, rules, monthCharacters] = await Promise.all([
    collectCandidates(),
    translationRules(),
    billedSince(startOfUtcMonth(now)),
  ])
  const memory = await reusable(candidates)
  const rows = new Map<string, BackfillPlanRow>()
  const sentOnce = new Set<string>()
  const byBusiness = new Map<string, number>()
  let texts = 0
  let characters = 0
  for (const candidate of candidates) {
    const row = planRow(rows, candidate)
    const google = priced(candidate)
    if (!google) {
      row.skipped += 1
      continue
    }
    const reuse = reuseSlot(
      candidate.scope,
      candidate.sourceHash,
      candidate.language
    )
    // Meta's texts go once per English; the queue reuses only what Google
    // translated before its run.
    if (
      memory.has(reuse) ||
      (candidate.kind === "meta" && sentOnce.has(reuse))
    ) {
      row.reused += 1
      continue
    }
    if (candidate.kind === "meta") sentOnce.add(reuse)
    const count = candidate.kind === "gap" ? row.gaps : row[candidate.kind]
    count.texts += 1
    count.characters += google.characters
    texts += 1
    characters += google.characters
    if (candidate.businessId !== null) {
      byBusiness.set(
        candidate.businessId,
        (byBusiness.get(candidate.businessId) ?? 0) + google.characters
      )
    }
  }
  const freeLeft = Math.max(0, GOOGLE_FREE_MONTHLY_CHARACTERS - monthCharacters)
  const paidCharacters = Math.max(0, characters - freeLeft)
  const busiest = Math.max(0, ...byBusiness.values())
  return {
    rows: [...rows.values()].sort(
      (a, b) =>
        a.scope.localeCompare(b.scope) || a.language.localeCompare(b.language)
    ),
    texts,
    characters,
    monthCharacters,
    freeCharacters: GOOGLE_FREE_MONTHLY_CHARACTERS,
    freeLeft,
    paidCharacters,
    usdPerMillion: GOOGLE_NMT_USD_PER_MILLION_CHARACTERS,
    estimatedUsd:
      (paidCharacters / 1_000_000) * GOOGLE_NMT_USD_PER_MILLION_CHARACTERS,
    dailyBusinessCharacters: rules.dailyBusinessCharacters,
    days:
      busiest > 0
        ? Math.ceil(busiest / rules.dailyBusinessCharacters)
        : characters > 0
          ? 1
          : 0,
  }
}

function planRow(
  rows: Map<string, BackfillPlanRow>,
  candidate: Candidate
): BackfillPlanRow {
  const key = `${candidate.scope}\n${candidate.language}`
  let row = rows.get(key)
  if (!row) {
    row = {
      scope: candidate.scope,
      language: candidate.language,
      meta: { texts: 0, characters: 0 },
      fake: { texts: 0, characters: 0 },
      gaps: { texts: 0, characters: 0 },
      reused: 0,
      skipped: 0,
    }
    rows.set(key, row)
  }
  return row
}

// Characters sent to Google since `start`, as Admin → Translations counts
// them (features/admin/api/translations.ts getTranslationOverview).
async function billedSince(start: Date): Promise<number> {
  const [row] = await db
    .select({
      characters: sql<number>`coalesce(sum(${translationHistory.characters}), 0)`,
    })
    .from(translationHistory)
    .where(gte(translationHistory.changedAt, start.toISOString()))
  return Number(row.characters)
}

export interface BackfillResult {
  // Each real business brought in line with its current English first.
  synced: SyncResult
  // Gaps and the test translator's texts now waiting in the queue: the
  // server's timer sends them.
  queued: number
  // Meta's texts now Google's, `reused` of them free.
  replaced: number
  reused: number
  // Past a business's daily limit or this run's most: still Meta's, for
  // the next run.
  deferred: number
  // Changed while Google worked (an admin's edit, a newer English): left
  // as they are.
  kept: number
  // Google's request failed, or its answer lost a field: still Meta's.
  failed: number
  // Google's last error, if any.
  error: string | null
  // Characters sent to Google (billed).
  characters: number
}

interface Sending extends GoogleTexts {
  entry: Entry
  // Meta's texts with the same English, in the same language: they get
  // the same answer, free.
  followers: Entry[]
}

// The real run, only after the owner's go on the cost, with Google only:
// the test translator's text would replace Meta's real words.
export async function runBackfill(options: {
  translator: Translator
  confirm: true
  // The most characters this run sends of Meta's texts; the rest stay
  // Meta's for a later run (monthly parts inside the free allowance).
  maxCharacters?: number
  now?: () => Date
}): Promise<BackfillResult> {
  const { translator } = options
  if (options.confirm !== true) {
    throw new Error("The backfill runs only when confirmed")
  }
  if (translator.name !== "google") {
    throw new Error("The backfill runs with Google only")
  }
  const now = options.now?.() ?? new Date()
  const result: BackfillResult = {
    synced: { added: 0, changed: 0, removed: 0 },
    queued: 0,
    replaced: 0,
    reused: 0,
    deferred: 0,
    kept: 0,
    failed: 0,
    error: null,
    characters: 0,
  }

  // 1. Every real business in line with its English, as a save does.
  for (const businessId of await realBusinesses()) {
    const synced = await syncBusinessTexts(businessId)
    if (!synced) continue
    result.synced.added += synced.added
    result.synced.changed += synced.changed
    result.synced.removed += synced.removed
  }

  // 2. Gaps and the test translator's texts wait in the normal queue.
  const metas: Candidate[] = []
  for (const candidate of await collectCandidates()) {
    if (candidate.kind === "meta") {
      metas.push(candidate)
      continue
    }
    const { entry } = candidate
    // Only texts already in line with their English (a save meanwhile
    // brings the others in line itself) and that Google can take.
    if (
      !entry ||
      entry.sourceHash !== candidate.sourceHash ||
      !priced(candidate)
    ) {
      continue
    }
    if (entry.status === "pending") {
      result.queued += 1
      continue
    }
    if (await requeue(entry, entry.status === "failed" ? "retry" : "reset")) {
      result.queued += 1
    }
  }

  // 3. Meta's texts, each English once, within each business's daily
  // limit and this run's most.
  const rules = await translationRules()
  const memory = await reusable(metas)
  const used = await usedToday(metas, now)
  const sending = new Map<string, Sending>()
  const requests = new Map<TranslationLanguage, Sending[]>()
  let planned = 0
  const tally = (saved: boolean, free: boolean) => {
    if (!saved) {
      result.kept += 1
      return
    }
    result.replaced += 1
    if (free) result.reused += 1
  }
  for (const candidate of metas) {
    const { entry } = candidate
    const google = priced(candidate)
    if (!entry || !google || !isTranslationLanguage(entry.language)) continue
    const reuse = reuseSlot(entry.scope, entry.sourceHash, entry.language)
    const known = memory.get(reuse)
    if (known !== undefined) {
      tally(await replace(entry, known, translator.name, "memory", 0), true)
      continue
    }
    const same = sending.get(reuse)
    if (same) {
      same.followers.push(entry)
      continue
    }
    const spent =
      entry.businessId === null ? 0 : (used.get(entry.businessId) ?? 0)
    if (
      (entry.businessId !== null &&
        spent + google.characters > rules.dailyBusinessCharacters) ||
      (options.maxCharacters !== undefined &&
        planned + google.characters > options.maxCharacters)
    ) {
      result.deferred += 1
      continue
    }
    if (entry.businessId !== null) {
      used.set(entry.businessId, spent + google.characters)
    }
    // A message with no words of its own ("{count}") is the same in every
    // language.
    if (google.htmls.length === 0) {
      const text = google.read([])
      if (text === null) result.failed += 1
      else
        tally(await replace(entry, text, translator.name, "google", 0), false)
      continue
    }
    planned += google.characters
    const item: Sending = { ...google, entry, followers: [] }
    sending.set(reuse, item)
    const list = requests.get(entry.language) ?? []
    list.push(item)
    requests.set(entry.language, list)
  }

  // 4. Google, in requests of Google's recommended size.
  for (const [language, items] of requests) {
    for (const batch of requestBatches(items, rules)) {
      let answers: string[]
      try {
        answers = await translator.translate(
          batch.flatMap((item) => item.htmls),
          GOOGLE_LANGUAGE_CODES[language]
        )
      } catch (error) {
        result.error = (
          error instanceof Error ? error.message : String(error)
        ).slice(0, 200)
        result.failed += batch.reduce(
          (sum, item) => sum + 1 + item.followers.length,
          0
        )
        continue
      }
      let next = 0
      for (const item of batch) {
        result.characters += item.characters
        const mine = answers.slice(next, next + item.htmls.length)
        next += item.htmls.length
        const text = mine.length === item.htmls.length ? item.read(mine) : null
        if (text === null) {
          await recordBilled(item.entry, mine.join("\n"), item.characters)
          result.failed += 1 + item.followers.length
          continue
        }
        tally(
          await replace(
            item.entry,
            text,
            translator.name,
            "google",
            item.characters
          ),
          false
        )
        for (const follower of item.followers) {
          tally(
            await replace(follower, text, translator.name, "memory", 0),
            true
          )
        }
      }
    }
  }
  return result
}

// The text as the backfill read it: same state, same maker, same English.
// Checked in the business's turn, like the queue's saves, and again in the
// update itself: the backfill runs in a script beside the server, whose
// saves take their turns apart.
function asRead(entry: Entry) {
  return and(
    eq(translationEntries.id, entry.id),
    eq(translationEntries.status, entry.status),
    entry.origin === null
      ? isNull(translationEntries.origin)
      : eq(translationEntries.origin, entry.origin),
    eq(translationEntries.sourceHash, entry.sourceHash)
  )
}

async function isAsRead(entry: Entry): Promise<boolean> {
  const [row] = await db
    .select({ id: translationEntries.id })
    .from(translationEntries)
    .where(asRead(entry))
  return row !== undefined
}

// Google's translation replaces Meta's while the text is still as read; the
// characters Google billed are recorded either way. True when replaced.
async function replace(
  entry: Entry,
  text: string,
  origin: Translator["name"],
  action: "google" | "memory",
  characters: number
): Promise<boolean> {
  return runInTurn(turnKey(entry.scope, entry.businessId), async () => {
    const unchanged = await isAsRead(entry)
    await saveAll([
      ...(unchanged
        ? [
            db
              .update(translationEntries)
              .set({
                text,
                machineText: text,
                machineSourceHash: entry.sourceHash,
                status: "automatic",
                origin,
                attempts: 0,
                nextAttemptAt: null,
                lastError: null,
              })
              .where(asRead(entry)),
          ]
        : []),
      ...(unchanged || characters > 0
        ? [
            db.insert(translationHistory).values({
              ...historyOf(entry),
              action,
              before: entry.text,
              after: text,
              characters,
            }),
          ]
        : []),
    ])
    if (unchanged && entry.scope === "interface") forgetInterfaceWords()
    return unchanged
  })
}

// A Google answer that could not be used is still billed; Meta's stays.
async function recordBilled(entry: Entry, answer: string, characters: number) {
  await db.insert(translationHistory).values({
    ...historyOf(entry),
    action: "google",
    before: entry.text,
    after: answer,
    characters,
  })
}

// A failed text, or the test translator's, waits for Google again in the
// normal queue, as Retry and Reset to Google do (lib/translations/edits.ts);
// the page shows the English meanwhile. True when it now waits.
async function requeue(
  entry: Entry,
  action: "retry" | "reset"
): Promise<boolean> {
  return runInTurn(turnKey(entry.scope, entry.businessId), async () => {
    if (!(await isAsRead(entry))) return false
    await saveAll([
      db
        .update(translationEntries)
        .set({
          status: "pending",
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
        })
        .where(asRead(entry)),
      db.insert(translationHistory).values({
        ...historyOf(entry),
        action,
        before: entry.text,
        after: null,
      }),
    ])
    if (entry.scope === "interface") forgetInterfaceWords()
    return true
  })
}

function slot(key: string, language: string): string {
  return `${key}\n${language}`
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
