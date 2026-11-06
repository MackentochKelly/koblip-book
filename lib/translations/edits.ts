import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { translationEntries, translationHistory } from "@/lib/db/schema"
import { runInTurn } from "@/lib/run-in-turn"
import { keepsProtectedParts } from "./markup"
import { historyOf, turnKey } from "./queue"
import { TRANSLATION_RULES } from "./rules"

// An admin's changes to one translation (Admin → Translations), each logged
// in its history with who made it. They wait their turn with the queue's
// saves for the same business, so a Google answer arriving meanwhile never
// overwrites them (lib/translations/queue.ts saveTranslation).

type Entry = typeof translationEntries.$inferSelect

export type TranslationEditResult =
  | { ok: true; entry: Entry }
  | {
      ok: false
      error: "not_found" | "empty" | "too_long" | "fields" | "not_failed"
    }

async function entryById(id: string): Promise<Entry | undefined> {
  const [entry] = await db
    .select()
    .from(translationEntries)
    .where(eq(translationEntries.id, id))
  return entry
}

// Runs a change on one entry in its business's turn, with the entry as it
// is inside that turn.
async function change(
  id: string,
  apply: (entry: Entry) => Promise<TranslationEditResult>
): Promise<TranslationEditResult> {
  const first = await entryById(id)
  if (!first) return { ok: false, error: "not_found" }
  return runInTurn(turnKey(first.scope, first.businessId), async () => {
    const entry = await entryById(id)
    return entry ? apply(entry) : { ok: false, error: "not_found" }
  })
}

// The admin's own translation: shown from now on and never overwritten by
// Google; when the English changes later it shows Needs review. Saving one
// that needs review marks it reviewed. Fields, links and emails must stay as
// in English.
export function editTranslation(input: {
  id: string
  text: string
  userId: string
}): Promise<TranslationEditResult> {
  const text = input.text.trim()
  return change(input.id, async (entry) => {
    if (text === "") return { ok: false, error: "empty" }
    if ([...text].length > TRANSLATION_RULES.maxTextCharacters) {
      return { ok: false, error: "too_long" }
    }
    if (!keepsProtectedParts(entry.sourceText, text)) {
      return { ok: false, error: "fields" }
    }
    if (entry.status === "edited" && entry.text === text) {
      return { ok: true, entry }
    }
    const set = {
      text,
      status: "edited" as const,
      origin: "manual" as const,
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
    }
    await saveAll([
      db
        .update(translationEntries)
        .set(set)
        .where(eq(translationEntries.id, entry.id)),
      db.insert(translationHistory).values({
        ...historyOf(entry),
        action: "edited",
        before: entry.text,
        after: text,
        changedBy: input.userId,
      }),
    ])
    return { ok: true, entry: { ...entry, ...set } }
  })
}

// Google translates the current English again; the page shows the English
// until it answers. Undoes an admin's edit, and makes an earlier
// translation (Meta's, or the test translator's) Google's.
export function resetTranslation(input: {
  id: string
  userId: string
}): Promise<TranslationEditResult> {
  return change(input.id, (entry) =>
    requeue(entry, "reset", input.userId)
  )
}

// A Failed text tries again from the start.
export function retryTranslation(input: {
  id: string
  userId: string
}): Promise<TranslationEditResult> {
  return change(input.id, async (entry) =>
    entry.status === "failed"
      ? requeue(entry, "retry", input.userId)
      : { ok: false, error: "not_failed" }
  )
}

async function requeue(
  entry: Entry,
  action: "reset" | "retry",
  userId: string
): Promise<TranslationEditResult> {
  const set = {
    status: "pending" as const,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  }
  await saveAll([
    db
      .update(translationEntries)
      .set(set)
      .where(eq(translationEntries.id, entry.id)),
    db.insert(translationHistory).values({
      ...historyOf(entry),
      action,
      before: entry.text,
      after: null,
      changedBy: userId,
    }),
  ])
  return { ok: true, entry: { ...entry, ...set } }
}
