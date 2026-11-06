"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { revalidateBusiness } from "@/lib/revalidate-business"
import {
  editTranslation,
  resetTranslation,
  retryTranslation,
  type TranslationEditResult,
} from "@/lib/translations/edits"
import type { TranslationRuleKey } from "@/lib/translations/rules"
import { translateSoon } from "@/lib/translations/schedule"
import {
  isTranslationRuleKey,
  setTranslationRule,
  TranslationRuleError,
} from "@/lib/translations/settings"
import { TRANSLATIONS_BASE } from "../utils/translation-parts"

// Admin → Translations (G5): an admin's own translation, Reset to Google,
// Retry and the rules. Each checks the admin first; lib/translations logs
// every change with who made it.

export type TranslationActionResult =
  | { ok: true }
  | {
      ok: false
      error:
        | "invalid"
        | "not_found"
        | "empty"
        | "too_long"
        | "fields"
        | "not_failed"
        | "failed"
    }

// A text is at most Google's 30,000 characters; anything far longer is not
// read at all.
const MAX_INPUT = 100_000

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 64

async function done(
  result: TranslationEditResult,
  options: { translate: boolean }
): Promise<TranslationActionResult> {
  if (!result.ok) return result
  if (options.translate) translateSoon()
  revalidatePath(TRANSLATIONS_BASE, "layout")
  // The business's page shows the new translation on its next visit.
  if (result.entry.businessId) {
    const [business] = await db
      .select({ slug: businesses.slug })
      .from(businesses)
      .where(eq(businesses.id, result.entry.businessId))
    if (business) revalidateBusiness(business.slug)
  }
  return { ok: true }
}

async function attempt(
  run: () => Promise<TranslationActionResult>
): Promise<TranslationActionResult> {
  try {
    return await run()
  } catch (error) {
    console.error(error)
    return { ok: false, error: "failed" }
  }
}

export async function saveTranslationText(
  id: string,
  text: string
): Promise<TranslationActionResult> {
  const session = await requireAdmin()
  if (!isId(id) || typeof text !== "string" || text.length > MAX_INPUT) {
    return { ok: false, error: "invalid" }
  }
  return attempt(async () =>
    done(await editTranslation({ id, text, userId: session.userId }), {
      translate: false,
    })
  )
}

export async function resetTranslationToGoogle(
  id: string
): Promise<TranslationActionResult> {
  const session = await requireAdmin()
  if (!isId(id)) return { ok: false, error: "invalid" }
  return attempt(async () =>
    done(await resetTranslation({ id, userId: session.userId }), {
      translate: true,
    })
  )
}

export async function retryFailedTranslation(
  id: string
): Promise<TranslationActionResult> {
  const session = await requireAdmin()
  if (!isId(id)) return { ok: false, error: "invalid" }
  return attempt(async () =>
    done(await retryTranslation({ id, userId: session.userId }), {
      translate: true,
    })
  )
}

// One rule's value for everyone, or null for its default.
export async function saveTranslationRule(
  key: TranslationRuleKey,
  value: unknown
): Promise<TranslationActionResult> {
  const session = await requireAdmin()
  if (typeof key !== "string" || !isTranslationRuleKey(key)) {
    return { ok: false, error: "invalid" }
  }
  try {
    await setTranslationRule({ key, value, userId: session.userId })
  } catch (error) {
    if (error instanceof TranslationRuleError) {
      return { ok: false, error: "invalid" }
    }
    console.error(error)
    return { ok: false, error: "failed" }
  }
  revalidatePath(TRANSLATIONS_BASE, "layout")
  return { ok: true }
}
