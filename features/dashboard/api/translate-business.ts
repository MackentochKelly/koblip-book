import "server-only"

import { inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { type businesses, translations } from "@/lib/db/schema"
import { translateTexts } from "../utils/translate"
import { loadTranslatableTexts } from "./translatable-texts"

type Business = Pick<typeof businesses.$inferSelect, "id" | "description" | "category">
type TranslateResult =
  | { ok: true; translated: number }
  | { ok: false; error: "failed" }

// The last run per business in this server process, on globalThis so
// every module copy (a page, a Server Action, a dev reload) sees it.
const store = globalThis as typeof globalThis & {
  koblipTranslateRuns?: Map<string, Promise<TranslateResult>>
}
const runs = (store.koblipTranslateRuns ??= new Map())

// Brings a business's Spanish texts up to date (only new or changed ones
// go to Meta AI) and drops those of deleted items. No session check: the
// Translate action checks the owner, and the starter-catalog refill script
// and the sign-up setup run it on the server.
//
// One run at a time per business: a call made while one is going waits
// for it, then translates only what is still missing (often nothing), so
// the same text is never sent twice.
export function translateBusinessTexts(
  business: Business
): Promise<TranslateResult> {
  const previous = runs.get(business.id)
  const run = (previous ?? Promise.resolve())
    .catch(() => null)
    .then(() => translateNow(business))
  runs.set(business.id, run)
  const forget = () => {
    if (runs.get(business.id) === run) runs.delete(business.id)
  }
  run.then(forget, forget)
  return run
}

async function translateNow(business: Business): Promise<TranslateResult> {
  const { pending, existing, liveIds } = await loadTranslatableTexts(business)
  const orphanIds = existing
    .filter((row) => !liveIds.has(row.entityId))
    .map((row) => row.id)
  if (orphanIds.length > 0) {
    await db.delete(translations).where(inArray(translations.id, orphanIds))
  }

  let translated = 0
  if (pending.length > 0) {
    const got = await translateTexts(
      pending.map((item) => ({ id: item.id, text: item.text }))
    )
    if (got.size === 0) {
      return { ok: false, error: "failed" }
    }
    const now = new Date().toISOString()
    const rows = pending.flatMap((item) => {
      const text = got.get(item.id)
      return text === undefined
        ? []
        : [
            {
              businessId: business.id,
              entityId: item.entityId,
              field: item.field,
              language: "es",
              sourceText: item.text,
              text,
            },
          ]
    })
    if (rows.length === 0) {
      return { ok: false, error: "failed" }
    }
    await db
      .insert(translations)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          translations.entityId,
          translations.field,
          translations.language,
        ],
        set: {
          sourceText: sql`excluded.source_text`,
          text: sql`excluded.text`,
          updatedAt: now,
        },
      })
    translated = rows.length
  }
  return { ok: true, translated }
}
