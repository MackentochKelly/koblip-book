import "server-only"

import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { translationEntries, translationHistory } from "@/lib/db/schema"
import { runInTurn } from "@/lib/run-in-turn"
import {
  GOOGLE_LANGUAGE_CODES,
  isTranslationLanguage,
  TRANSLATION_LANGUAGES,
  type TranslationLanguage,
} from "./languages"
import {
  billedCharacters,
  fromGoogleHtml,
  sourceHash,
  toGoogleHtml,
} from "./markup"
import { toGoogleIcu } from "./icu"
import { forgetInterfaceWords } from "./interface-words"
import { getTranslator, type Translator } from "./provider"
import {
  TRANSLATION_RULES,
  type TranslationAction,
  type TranslationRules,
  type TranslationScope,
} from "./rules"
import { translationRules } from "./settings"

// The translation queue (docs/plans/translations.md, G2). Saving only
// records what changed (syncTexts); the run after the save
// (lib/translations/schedule.ts) and the server's timer
// (lib/translations/timer.ts) send the waiting texts to Google, so saving
// never waits for Google. The app's own words are ICU messages: they go
// to Google sentence by sentence (lib/translations/icu.ts).

type Entry = typeof translationEntries.$inferSelect
type HistoryRow = typeof translationHistory.$inferInsert

export interface SyncItem {
  // Interface: the word's key. Business: `${entityId}:${field}`.
  key: string
  // Interface: the page or part. Business: the kind of text.
  module: string
  // The current English.
  text: string
}

export interface SyncResult {
  added: number
  changed: number
  removed: number
}

// Brings one business's texts (or the app's own words) in line with the
// current English, in every translation language: a new text waits for
// Google; a changed one waits again, unless an admin edited it, which then
// stays and needs review. With `removeMissing`, texts no longer listed are
// removed (their history stays).
export async function syncTexts(input: {
  scope: TranslationScope
  businessId: string | null
  items: SyncItem[]
  removeMissing?: boolean
  languages?: readonly TranslationLanguage[]
}): Promise<SyncResult> {
  const { scope, businessId } = input
  if ((scope === "business") !== (businessId !== null)) {
    throw new Error("Business texts need their business; the app's own words none")
  }
  return runInTurn(turnKey(scope, businessId), () => syncNow(input))
}

async function syncNow(input: {
  scope: TranslationScope
  businessId: string | null
  items: SyncItem[]
  removeMissing?: boolean
  languages?: readonly TranslationLanguage[]
}): Promise<SyncResult> {
  const { scope, businessId, items } = input
  const languages = input.languages ?? TRANSLATION_LANGUAGES
  const current = await db
    .select()
    .from(translationEntries)
    .where(
      businessId === null
        ? and(
            eq(translationEntries.scope, scope),
            isNull(translationEntries.businessId)
          )
        : and(
            eq(translationEntries.scope, scope),
            eq(translationEntries.businessId, businessId)
          )
    )
  const byKey = new Map(current.map((entry) => [slot(entry), entry]))
  const wanted = new Set<string>()
  const inserts: (typeof translationEntries.$inferInsert)[] = []
  const changes: { id: string; set: Partial<Entry> }[] = []
  const history: HistoryRow[] = []

  for (const item of items) {
    if (item.text.trim() === "") {
      continue
    }
    const hash = sourceHash(item.text)
    for (const language of languages) {
      const key = slot({ key: item.key, language })
      if (wanted.has(key)) {
        continue
      }
      wanted.add(key)
      const entry = byKey.get(key)
      if (!entry) {
        inserts.push({
          scope,
          businessId,
          module: item.module,
          key: item.key,
          language,
          sourceText: item.text,
          sourceHash: hash,
          status: "pending",
        })
        continue
      }
      if (entry.sourceHash === hash) {
        continue
      }
      const edited = entry.status === "edited" || entry.status === "needs_review"
      changes.push({
        id: entry.id,
        set: edited
          ? {
              module: item.module,
              sourceText: item.text,
              sourceHash: hash,
              status: "needs_review",
            }
          : {
              module: item.module,
              sourceText: item.text,
              sourceHash: hash,
              status: "pending",
              attempts: 0,
              nextAttemptAt: null,
              lastError: null,
            },
      })
      history.push({
        entryId: entry.id,
        scope,
        businessId,
        key: entry.key,
        language,
        action: "source_changed",
        sourceText: item.text,
        before: entry.sourceText,
        after: item.text,
      })
    }
  }
  // A word whose key changed but whose English didn't keeps its
  // translation (an admin's own included): it moves to the new key instead
  // of being removed and made again.
  const leaving = input.removeMissing
    ? current.filter((entry) => !wanted.has(slot(entry)))
    : []
  const movable = new Map<string, Entry>()
  for (const entry of leaving) {
    if (entry.text !== null) movable.set(`${entry.language}\u0000${entry.sourceHash}`, entry)
  }
  const moved = new Set<string>()
  const newRows: typeof inserts = []
  for (const insert of inserts) {
    const old = movable.get(`${insert.language}\u0000${insert.sourceHash}`)
    if (old && !moved.has(old.id)) {
      moved.add(old.id)
      changes.push({ id: old.id, set: { key: insert.key, module: insert.module } })
      continue
    }
    newRows.push(insert)
  }
  const removeIds = leaving
    .filter((entry) => !moved.has(entry.id))
    .map((entry) => entry.id)

  await saveAll([
    ...chunks(newRows, 200).map((part) =>
      db.insert(translationEntries).values(part)
    ),
    ...changes.map((change) =>
      db
        .update(translationEntries)
        .set(change.set)
        .where(eq(translationEntries.id, change.id))
    ),
    ...chunks(history, 200).map((part) =>
      db.insert(translationHistory).values(part)
    ),
    ...chunks(removeIds, 500).map((part) =>
      db.delete(translationEntries).where(inArray(translationEntries.id, part))
    ),
  ])
  if (scope === "interface" && (changes.length > 0 || removeIds.length > 0)) {
    forgetInterfaceWords()
  }
  return {
    added: newRows.length,
    changed: changes.length,
    removed: removeIds.length,
  }
}

export interface QueueResult {
  // "not_set_up": no translator yet (G0), so texts keep waiting.
  status: "done" | "not_set_up"
  translated: number
  reused: number
  retrying: number
  failed: number
  deferred: number
  // Characters sent to Google (billed).
  characters: number
}

const store = globalThis as typeof globalThis & {
  koblipTranslationRun?: Promise<QueueResult>
}

// Sends the waiting texts to Google. One run at a time in this server: a
// call made during a run waits for it, then takes what is still waiting.
export function runTranslationQueue(
  options: { now?: () => Date; translator?: Translator | null } = {}
): Promise<QueueResult> {
  const previous = store.koblipTranslationRun
  const run = (previous ?? Promise.resolve())
    .catch(() => null)
    .then(() => runOnce(options))
  store.koblipTranslationRun = run
  const forget = () => {
    if (store.koblipTranslationRun === run) {
      store.koblipTranslationRun = undefined
    }
  }
  run.then(forget, forget)
  return run
}

// The app's words are read from memory: after a run that saved some, the
// next page reads them again (once per run, not per word).
async function runOnce(options: {
  now?: () => Date
  translator?: Translator | null
}): Promise<QueueResult> {
  const changed = { interface: false }
  try {
    return await runSteps(options, changed)
  } finally {
    if (changed.interface) forgetInterfaceWords()
  }
}

async function runSteps(
  options: { now?: () => Date; translator?: Translator | null },
  changed: { interface: boolean }
): Promise<QueueResult> {
  const save = async (...args: Parameters<typeof saveTranslation>) => {
    const saved = await saveTranslation(...args)
    if (saved && args[0].scope === "interface") changed.interface = true
    return saved
  }
  const result: QueueResult = {
    status: "done",
    translated: 0,
    reused: 0,
    retrying: 0,
    failed: 0,
    deferred: 0,
    characters: 0,
  }
  const translator =
    options.translator === undefined ? getTranslator() : options.translator
  if (!translator) {
    return { ...result, status: "not_set_up" }
  }
  const now = options.now?.() ?? new Date()
  const rules = await translationRules()
  const due = await db
    .select()
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.status, "pending"),
        or(
          isNull(translationEntries.nextAttemptAt),
          lte(translationEntries.nextAttemptAt, now.toISOString())
        )
      )
    )
    .orderBy(asc(translationEntries.createdAt))
    .limit(rules.runTexts)
  if (due.length === 0) {
    return result
  }

  // 1. Google already translated the same English into the same language.
  const memory = await reusable(due)
  const toSend: Entry[] = []
  for (const entry of due) {
    const text = memory.get(reuseSlot(entry.scope, entry.sourceHash, entry.language))
    if (text === undefined) {
      toSend.push(entry)
      continue
    }
    if (await save(entry, text, "google", "memory", 0)) {
      result.reused += 1
    }
  }

  // 2. Each business's daily limit; texts too long or in a language the
  // app no longer has fail at once.
  const used = await usedToday(toSend, now)
  used.set(APP_WORDS, await appWordsUsedToday(now))
  const tomorrow = startOfNextUtcDay(now).toISOString()
  const deferred: string[] = []
  const requests = new Map<TranslationLanguage, PreparedText[]>()
  for (const entry of toSend) {
    const prepared = prepare(entry)
    if (!prepared) {
      await failNow(entry, "The English isn't a valid message")
      result.failed += 1
      continue
    }
    const { characters } = prepared
    if (!isTranslationLanguage(entry.language)) {
      await failNow(entry, "This language is not in the app")
      result.failed += 1
      continue
    }
    if (characters > TRANSLATION_RULES.maxTextCharacters) {
      await failNow(entry, "The text is longer than Google takes at once")
      result.failed += 1
      continue
    }
    // Each business, and the app's own words together, have the daily
    // limit: a new release's words never send more in a day.
    const budget = entry.businessId ?? APP_WORDS
    const spent = used.get(budget) ?? 0
    if (spent + characters > rules.dailyBusinessCharacters) {
      deferred.push(entry.id)
      continue
    }
    used.set(budget, spent + characters)
    // A message with no words of its own ("{count}") is the same in
    // every language.
    if (prepared.htmls.length === 0) {
      const same = prepared.read([])
      if (same !== null && (await save(entry, same, translator.name, "google", 0))) {
        result.translated += 1
      }
      continue
    }
    const list = requests.get(entry.language) ?? []
    list.push(prepared)
    requests.set(entry.language, list)
  }
  for (const part of chunks(deferred, 500)) {
    await db
      .update(translationEntries)
      .set({ nextAttemptAt: tomorrow })
      .where(
        and(
          inArray(translationEntries.id, part),
          eq(translationEntries.status, "pending")
        )
      )
  }
  result.deferred = deferred.length

  // 3. Google, in requests of Google's recommended size.
  for (const [language, texts] of requests) {
    for (const batch of requestBatches(texts, rules)) {
      let answers: string[]
      try {
        answers = await translator.translate(
          batch.flatMap((item) => item.htmls),
          GOOGLE_LANGUAGE_CODES[language]
        )
      } catch (error) {
        const outcome = await failTry(
          batch.map((item) => item.entry),
          errorText(error),
          now,
          rules.retryMinutes
        )
        result.retrying += outcome.retrying
        result.failed += outcome.failed
        continue
      }
      let next = 0
      for (const item of batch) {
        result.characters += item.characters
        const mine = answers.slice(next, next + item.htmls.length)
        next += item.htmls.length
        const text = mine.length === item.htmls.length ? item.read(mine) : null
        if (text === null) {
          await recordBilled(item, mine.join("\n"))
          const outcome = await failTry(
            [item.entry],
            "Google changed a field, link or email",
            now,
            rules.retryMinutes
          )
          result.retrying += outcome.retrying
          result.failed += outcome.failed
          continue
        }
        if (
          await save(
            item.entry,
            text,
            translator.name,
            "google",
            item.characters
          )
        ) {
          result.translated += 1
        }
      }
    }
  }
  return result
}

export interface GoogleTexts {
  // What Google gets: one HTML text, or for an ICU message one per sentence.
  htmls: string[]
  // The translation from Google's answers, or null when one can't be used.
  read(answers: string[]): string | null
  // What Google bills for them.
  characters: number
  parts: number
}

interface PreparedText extends GoogleTexts {
  entry: Entry
}

// What Google gets for one English text and what it bills: a business text
// goes whole; the app's own words go as ICU messages. Null when the English
// isn't a valid message. The backfill's count uses it too
// (lib/translations/backfill.ts).
export function googleTexts(
  scope: TranslationScope,
  sourceText: string
): GoogleTexts | null {
  if (scope === "interface") {
    const icu = toGoogleIcu(sourceText)
    if (!icu) return null
    return {
      htmls: icu.htmls,
      read: icu.assemble,
      characters: icu.htmls.reduce((sum, html) => sum + billedCharacters(html), 0),
      parts: icu.htmls.length,
    }
  }
  const { html, kept } = toGoogleHtml(sourceText)
  return {
    htmls: [html],
    read: ([answer]) => fromGoogleHtml(answer ?? "", kept),
    characters: billedCharacters(html),
    parts: 1,
  }
}

function prepare(entry: Entry): PreparedText | null {
  const texts = googleTexts(entry.scope, entry.sourceText)
  return texts && { entry, ...texts }
}

// Requests of at most `requestCharacters` and `requestTexts` (an ICU
// message counts each of its sentences); a longer text goes alone.
export function requestBatches<T extends { characters: number; parts?: number }>(
  texts: T[],
  rules: Pick<TranslationRules, "requestCharacters" | "requestTexts"> = TRANSLATION_RULES
): T[][] {
  const batches: T[][] = []
  let batch: T[] = []
  let characters = 0
  let parts = 0
  for (const text of texts) {
    const size = text.parts ?? 1
    if (
      batch.length > 0 &&
      (parts + size > rules.requestTexts ||
        characters + text.characters > rules.requestCharacters)
    ) {
      batches.push(batch)
      batch = []
      characters = 0
      parts = 0
    }
    batch.push(text)
    characters += text.characters
    parts += size
  }
  if (batch.length > 0) {
    batches.push(batch)
  }
  return batches
}

// Google's earlier translations of the same English, by language, within
// the same scope: a business text isn't an ICU message, and an ICU message's
// quotes and braces mean something a business text's don't. Keyed by
// reuseSlot.
export async function reusable(
  entries: { sourceHash: string }[]
): Promise<Map<string, string>> {
  const hashes = [...new Set(entries.map((entry) => entry.sourceHash))]
  const found = new Map<string, string>()
  for (const part of chunks(hashes, 500)) {
    const rows = await db
      .select({
        language: translationEntries.language,
        scope: translationEntries.scope,
        sourceHash: translationEntries.sourceHash,
        text: translationEntries.text,
      })
      .from(translationEntries)
      .where(
        and(
          inArray(translationEntries.sourceHash, part),
          eq(translationEntries.status, "automatic"),
          eq(translationEntries.origin, "google")
        )
      )
    for (const row of rows) {
      if (row.text !== null) {
        found.set(reuseSlot(row.scope, row.sourceHash, row.language), row.text)
      }
    }
  }
  return found
}

// Characters each business sent to Google since midnight (UTC).
// The app's own words' place in the daily limits (no business id is empty).
const APP_WORDS = ""

async function appWordsUsedToday(now: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${translationHistory.characters}), 0)`,
    })
    .from(translationHistory)
    .where(
      and(
        eq(translationHistory.scope, "interface"),
        gte(translationHistory.changedAt, startOfUtcDay(now).toISOString())
      )
    )
  return Number(row?.total ?? 0)
}

export async function usedToday(
  entries: { businessId: string | null }[],
  now: Date
): Promise<Map<string, number>> {
  const ids = [
    ...new Set(
      entries
        .map((entry) => entry.businessId)
        .filter((id): id is string => id !== null)
    ),
  ]
  const used = new Map<string, number>()
  for (const part of chunks(ids, 500)) {
    const rows = await db
      .select({
        businessId: translationHistory.businessId,
        total: sql<number>`coalesce(sum(${translationHistory.characters}), 0)`,
      })
      .from(translationHistory)
      .where(
        and(
          inArray(translationHistory.businessId, part),
          gte(translationHistory.changedAt, startOfUtcDay(now).toISOString())
        )
      )
      .groupBy(translationHistory.businessId)
    for (const row of rows) {
      if (row.businessId !== null) {
        used.set(row.businessId, Number(row.total))
      }
    }
  }
  return used
}

// Saves a translation while the text still waits for this same English
// (an admin edit or a newer English in the meantime wins). True when saved.
async function saveTranslation(
  entry: Entry,
  text: string,
  origin: Translator["name"],
  action: Extract<TranslationAction, "google" | "memory">,
  characters: number
): Promise<boolean> {
  return runInTurn(turnKey(entry.scope, entry.businessId), async () => {
    const waiting = await stillWaiting(entry)
    await saveAll([
      ...(waiting
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
              .where(eq(translationEntries.id, entry.id)),
          ]
        : []),
      // Billed characters are recorded even when the text changed meanwhile.
      ...(waiting || characters > 0
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
    return waiting
  })
}

// The text still waits for the English it was sent with: no admin edit and
// no newer English since.
async function stillWaiting(entry: Entry): Promise<boolean> {
  const [current] = await db
    .select({
      status: translationEntries.status,
      sourceHash: translationEntries.sourceHash,
    })
    .from(translationEntries)
    .where(eq(translationEntries.id, entry.id))
  return (
    current !== undefined &&
    current.status === "pending" &&
    current.sourceHash === entry.sourceHash
  )
}

// A Google answer that could not be used is still billed.
async function recordBilled(item: PreparedText, answer: string) {
  await db.insert(translationHistory).values({
    ...historyOf(item.entry),
    action: "google",
    before: item.entry.text,
    after: answer,
    characters: item.characters,
  })
}

// One more failed try: it waits for the next retry time, or after the last
// retry it is Failed.
async function failTry(
  entries: Entry[],
  error: string,
  now: Date,
  waits: readonly number[]
): Promise<{ retrying: number; failed: number }> {
  const outcome = { retrying: 0, failed: 0 }
  for (const entry of entries) {
    const attempts = entry.attempts + 1
    const failed = attempts > waits.length
    const changed = await runInTurn(
      turnKey(entry.scope, entry.businessId),
      async () => {
        if (!(await stillWaiting(entry))) {
          return false
        }
        await saveAll([
          db
            .update(translationEntries)
            .set({
              attempts,
              lastError: error,
              status: failed ? "failed" : "pending",
              nextAttemptAt: failed
                ? null
                : new Date(
                    now.getTime() + waits[attempts - 1] * 60_000
                  ).toISOString(),
            })
            .where(eq(translationEntries.id, entry.id)),
          ...(failed ? [failedHistory(entry)] : []),
        ])
        return true
      }
    )
    if (changed) {
      outcome[failed ? "failed" : "retrying"] += 1
    }
  }
  return outcome
}

// Fails at once: retrying cannot help.
async function failNow(entry: Entry, error: string) {
  await runInTurn(turnKey(entry.scope, entry.businessId), async () => {
    if (!(await stillWaiting(entry))) {
      return
    }
    await saveAll([
      db
        .update(translationEntries)
        .set({ status: "failed", lastError: error, nextAttemptAt: null })
        .where(eq(translationEntries.id, entry.id)),
      failedHistory(entry),
    ])
  })
}

function failedHistory(entry: Entry) {
  return db.insert(translationHistory).values({
    ...historyOf(entry),
    action: "failed",
    before: entry.text,
    after: null,
  })
}

// Saves for one business (or the app's own words) go one at a time.
export function turnKey(scope: TranslationScope, businessId: string | null): string {
  return `translations:${scope}:${businessId ?? "app"}`
}

export function historyOf(entry: Entry) {
  return {
    entryId: entry.id,
    scope: entry.scope,
    businessId: entry.businessId,
    key: entry.key,
    language: entry.language,
    sourceText: entry.sourceText,
  }
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200)
}

export function reuseSlot(
  scope: TranslationScope,
  hash: string,
  language: string
): string {
  return `${scope}\u0000${hash}\u0000${language}`
}

function slot(entry: { key: string; language: string }): string {
  return `${entry.key}\n${entry.language}`
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function startOfNextUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(date).getTime() + 24 * 60 * 60 * 1000)
}

function chunks<T>(items: T[], size: number): T[][] {
  const parts: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    parts.push(items.slice(index, index + size))
  }
  return parts
}
