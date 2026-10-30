"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  businesses,
  notificationSettings,
  notificationTexts,
} from "@/lib/db/schema"
import { adminChangeEntry, notificationRules } from "@/lib/platform-settings"
import type { AdminActionResult } from "./actions"

// What an admin changes for one business on WhatsApp → Businesses (A4). Each
// change is saved with its entry in the change log, together.

type Message = (typeof notificationTexts.message.enumValues)[number]
const MESSAGES = notificationTexts.message.enumValues

const pathOf = (businessId: string) =>
  `/admin/whatsapp/businesses/${businessId}`

async function businessExists(businessId: string) {
  if (typeof businessId !== "string") return false
  const [row] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  return !!row
}

async function settingsRow(businessId: string) {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.businessId, businessId))
    .limit(1)
  return row ?? null
}

// Saves which messages are off, making the business's settings from the
// defaults when it has none yet.
async function saveTurnedOff(
  businessId: string,
  turnedOff: Message[],
  before: Message[],
  userId: string
) {
  const rules = await notificationRules(businessId)
  await saveAll([
    db
      .insert(notificationSettings)
      .values({
        businessId,
        reminders: [...rules.defaultReminders],
        quietStart: rules.defaultQuietStart,
        quietEnd: rules.defaultQuietEnd,
        turnedOff,
      })
      .onConflictDoUpdate({
        target: notificationSettings.businessId,
        set: { turnedOff },
      }),
    adminChangeEntry({
      key: "whatsapp.turnedOff",
      businessId,
      before,
      after: turnedOff,
      userId,
    }),
  ])
}

// Turns one of the business's messages on or off.
export async function setBusinessMessageOn(
  businessId: string,
  message: Message,
  on: boolean
): Promise<AdminActionResult> {
  const session = await requireAdmin()
  if (!MESSAGES.includes(message) || typeof on !== "boolean")
    return { ok: false }
  if (!(await businessExists(businessId))) return { ok: false }
  const before = (await settingsRow(businessId))?.turnedOff ?? []
  const rest = before.filter((item) => item !== message)
  const after = on ? rest : [...rest, message]
  if (after.length !== before.length) {
    await saveTurnedOff(businessId, after, before, session.userId)
  }
  revalidatePath(pathOf(businessId))
  return { ok: true }
}

// Turns every message of the business off.
export async function turnOffBusinessWhatsapp(
  businessId: string
): Promise<AdminActionResult> {
  const session = await requireAdmin()
  if (!(await businessExists(businessId))) return { ok: false }
  const before = (await settingsRow(businessId))?.turnedOff ?? []
  if (before.length !== MESSAGES.length) {
    await saveTurnedOff(businessId, [...MESSAGES], before, session.userId)
  }
  revalidatePath(pathOf(businessId))
  revalidatePath("/admin/whatsapp/businesses")
  return { ok: true }
}

// Reminders, quiet hours, the 24-hour setting, "Can't make it" and the
// thank-you back to the defaults. Which messages are on and the owner's own
// number and language stay as they are.
export async function resetBusinessSettings(
  businessId: string
): Promise<AdminActionResult> {
  const session = await requireAdmin()
  if (!(await businessExists(businessId))) return { ok: false }
  const row = await settingsRow(businessId)
  if (row) {
    const rules = await notificationRules(businessId)
    const next = {
      reminders: [...rules.defaultReminders],
      quietStart: rules.defaultQuietStart,
      quietEnd: rules.defaultQuietEnd,
      freeTextInWindow: rules.defaultFreeTextInWindow,
      cantCome: rules.defaultCantCome as "cancel" | "alertOnly",
      thankYouReply: rules.defaultThankYouReply,
    }
    const before = {
      reminders: row.reminders,
      quietStart: row.quietStart,
      quietEnd: row.quietEnd,
      freeTextInWindow: row.freeTextInWindow,
      cantCome: row.cantCome,
      thankYouReply: row.thankYouReply,
    }
    if (JSON.stringify(before) !== JSON.stringify(next)) {
      await saveAll([
        db
          .update(notificationSettings)
          .set(next)
          .where(eq(notificationSettings.businessId, businessId)),
        adminChangeEntry({
          key: "whatsapp.settings",
          businessId,
          before,
          after: null,
          userId: session.userId,
        }),
      ])
    }
  }
  revalidatePath(pathOf(businessId))
  return { ok: true }
}

// One message's wording and buttons back to Book's, in both languages. A
// template already at Meta stays there; the business's page then shows the
// message as not submitted.
export async function resetBusinessWording(
  businessId: string,
  message: Message
): Promise<AdminActionResult> {
  const session = await requireAdmin()
  if (!MESSAGES.includes(message)) return { ok: false }
  if (!(await businessExists(businessId))) return { ok: false }
  const where = and(
    eq(notificationTexts.businessId, businessId),
    eq(notificationTexts.message, message)
  )
  const before = await db
    .select({
      language: notificationTexts.language,
      header: notificationTexts.header,
      body: notificationTexts.body,
      footer: notificationTexts.footer,
      buttons: notificationTexts.buttons,
    })
    .from(notificationTexts)
    .where(where)
  if (before.length) {
    await saveAll([
      db.delete(notificationTexts).where(where),
      adminChangeEntry({
        key: `whatsapp.wording.${message}`,
        businessId,
        before,
        after: null,
        userId: session.userId,
      }),
    ])
  }
  revalidatePath(pathOf(businessId))
  return { ok: true }
}
