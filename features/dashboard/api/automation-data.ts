import "server-only"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { automations, businesses } from "@/lib/db/schema"
import type { Automation } from "../types/automations"
import { welcomeDefaults, withEveryLanguage } from "../utils/automation-defaults"
import { welcomeWords } from "./message-words"

// Internal data read. Owner/admin queries authorize before calling this in B2.
export async function readAutomations(businessId: string): Promise<Automation[]> {
  const [business] = await db.select({ id: businesses.id }).from(businesses)
    .where(eq(businesses.id, businessId)).limit(1)
  if (!business) return []

  // The unique key makes simultaneous first reads safe; a read never resets
  // existing wording, button identities, on/off or timestamps.
  const defaults = welcomeDefaults(await welcomeWords())
  await db.insert(automations).values({
    businessId,
    key: "welcome",
    trigger: "firstMessage",
    on: false,
    ...defaults,
    isDefault: true,
  }).onConflictDoNothing({ target: [automations.businessId, automations.key] })

  // Every language, also for a flow saved before a language came.
  const rows = await db.select({
    id: automations.id,
    trigger: automations.trigger,
    on: automations.on,
    wording: automations.wording,
    buttons: automations.buttons,
    isDefault: automations.isDefault,
    updatedAt: automations.updatedAt,
  }).from(automations).where(eq(automations.businessId, businessId))
    .orderBy(asc(automations.createdAt), asc(automations.id))
  return rows.map((row) => withEveryLanguage(row, defaults))
}
