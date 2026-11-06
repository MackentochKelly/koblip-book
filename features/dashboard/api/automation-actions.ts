"use server"

import "server-only"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { PAGE_LANGUAGES } from "@/lib/page-language"
import { saveAll } from "@/lib/db/save-all"
import { automations, chatConnections } from "@/lib/db/schema"
import { automationRules } from "@/lib/platform-settings"
import { runInTurn } from "@/lib/run-in-turn"
import type { AutomationButton, AutomationSaveResult, AutomationWording } from "../types/automations"
import { welcomeDefaults } from "../utils/automation-defaults"
import { automationProblem } from "../utils/automation-rules"
import { chatConnectionUsable } from "./chat-oauth"
import { welcomeWords } from "./message-words"
import { getOwnerBusiness } from "./queries"

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const trimmed = (value: unknown) => typeof value === "string" ? value.trim() : value

// Only the saved-content shape reaches the validator; an extra message type
// must never select its rendered-message validation branch instead.
function content(input: unknown): unknown {
  if (!object(input)) return input
  const wording = object(input.wording)
    ? Object.fromEntries(PAGE_LANGUAGES.map((language) => {
      const text = (input.wording as Record<string, unknown>)[language]
      return [language, object(text) ? {
        body: trimmed(text.body),
        handoffReply: trimmed(text.handoffReply),
        servicesIntro: trimmed(text.servicesIntro),
      } : text]
    })) : input.wording
  const buttons = Array.isArray(input.buttons) ? input.buttons.map((button: unknown) => {
    if (!object(button)) return button
    return {
      id: button.id,
      label: object(button.label)
        ? Object.fromEntries(PAGE_LANGUAGES.map((language) => [language, trimmed((button.label as Record<string, unknown>)[language])]))
        : button.label,
      action: button.action,
    }
  }) : input.buttons
  return { wording, buttons }
}

async function ownNumber(businessId: string) {
  const [connection] = await db.select().from(chatConnections)
    .where(eq(chatConnections.businessId, businessId)).limit(1)
  return !!connection && chatConnectionUsable(connection) &&
    !!connection.phoneNumberId && !!connection.accessToken && !!connection.refreshToken &&
    connection.scopes.split(" ").includes("conversations")
}

function where(businessId: string, automationId: string) {
  return and(eq(automations.businessId, businessId), eq(automations.id, automationId))
}

export async function saveAutomation(
  businessId: string,
  automationId: string,
  input: { wording: AutomationWording; buttons: AutomationButton[] } | null
): Promise<AutomationSaveResult> {
  try {
    await getOwnerBusiness(businessId)
  } catch {
    return { ok: false, error: "not_found" }
  }
  if (typeof automationId !== "string" || !automationId.trim()) return { ok: false, error: "invalid" }
  try {
    return await runInTurn(`automation:${businessId}:${automationId}`, async () => {
      const [row] = await db.select().from(automations).where(where(businessId, automationId)).limit(1)
      if (!row) return { ok: false, error: "not_found" }
      // Reset is defined for Book's built-in welcome; future keys must supply
      // their own defaults rather than silently becoming another welcome.
      if (input === null && row.key !== "welcome") return { ok: false, error: "invalid" }
      const next = input === null ? welcomeDefaults(await welcomeWords()) : content(input)
      const problem = automationProblem(next, await automationRules())
      if (problem) return { ok: false, ...problem }
      const saved = next as { wording: AutomationWording; buttons: AutomationButton[] }
      await saveAll([
        db.update(automations).set({ ...saved, isDefault: input === null })
          .where(where(businessId, automationId)),
      ])
      revalidatePath(`/dashboard/${businessId}/automations`, "layout")
      return { ok: true }
    })
  } catch {
    // The Contract has no storage-error variant; return a generic failure
    // without exposing database details, message text or customer data.
    return { ok: false, error: "invalid" }
  }
}

export async function setAutomationOn(
  businessId: string,
  automationId: string,
  on: boolean
): Promise<AutomationSaveResult> {
  try {
    await getOwnerBusiness(businessId)
  } catch {
    return { ok: false, error: "not_found" }
  }
  if (typeof automationId !== "string" || !automationId.trim() || typeof on !== "boolean") {
    return { ok: false, error: "invalid" }
  }
  try {
    return await runInTurn(`automation:${businessId}:${automationId}`, async () => {
      const [row] = await db.select().from(automations).where(where(businessId, automationId)).limit(1)
      if (!row) return { ok: false, error: "not_found" }
      const problem = automationProblem({ wording: row.wording, buttons: row.buttons }, await automationRules())
      // Turning off must remain possible after rules or the connection change.
      if (on && problem) return { ok: false, ...problem }
      if (on && !(await ownNumber(businessId))) return { ok: false, error: "noOwnNumber" }
      await saveAll([db.update(automations).set({ on }).where(where(businessId, automationId))])
      revalidatePath(`/dashboard/${businessId}/automations`, "layout")
      return { ok: true }
    })
  } catch {
    return { ok: false, error: "invalid" }
  }
}
