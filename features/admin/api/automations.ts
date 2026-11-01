import "server-only"
import { and, asc, desc, eq, lt, or, sql, type SQL } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { automationRuns, automations, businesses } from "@/lib/db/schema"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"

type Automation = Pick<typeof automations.$inferSelect,
  "id" | "trigger" | "on" | "wording" | "buttons" | "isDefault" | "updatedAt">
type AutomationRun = Pick<typeof automationRuns.$inferSelect,
  "id" | "automationId" | "customerPhone" | "customerName" | "step" | "state" | "reason" | "at">
export type BusinessAutomationRun = AutomationRun & {
  businessId: string
  businessName: string
  timeZone: string
}

type RunFilter = { businessId?: string; state?: AutomationRun["state"]; search?: string; cursor?: string }
type Cursor = {
  businessId: string | null
  state: AutomationRun["state"] | null
  search: string
  at: string
  id: string
}

function validFilter(filter: RunFilter): boolean {
  return !!filter && typeof filter === "object" && !Array.isArray(filter) &&
    Object.keys(filter).every((key) => ["businessId", "state", "search", "cursor"].includes(key)) &&
    (filter.businessId === undefined || (typeof filter.businessId === "string" && !!filter.businessId.trim())) &&
    (filter.state === undefined || ["sent", "failed", "skipped"].includes(filter.state)) &&
    (filter.search === undefined || typeof filter.search === "string") &&
    (filter.cursor === undefined || (typeof filter.cursor === "string" && !!filter.cursor))
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function readCursor(value: string, filter: RunFilter, search: string): Cursor | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
    const bytes = Buffer.from(value, "base64url")
    if (bytes.toString("base64url") !== value) return null
    const cursor: unknown = JSON.parse(bytes.toString("utf8"))
    if (!object(cursor)) return null
    const row = cursor
    if (Object.keys(row).length !== 5 || row.businessId !== (filter.businessId ?? null) ||
      row.state !== (filter.state ?? null) || row.search !== search ||
      typeof row.at !== "string" || new Date(row.at).toISOString() !== row.at ||
      typeof row.id !== "string" || !row.id) return null
    return { businessId: filter.businessId ?? null, state: filter.state ?? null, search, at: row.at, id: row.id }
  } catch {
    return null
  }
}

function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

function searchCondition(search: string): SQL | undefined {
  if (!search) return undefined
  const byName = sql`${automationRuns.customerName} like ${contains(search)} escape '\\'`
  const digits = search.replace(/\D/g, "")
  return digits ? or(byName, sql`${automationRuns.customerPhone} like ${contains(digits)} escape '\\'`) : byName
}

export async function adminAutomations(businessId: string): Promise<Automation[]> {
  await requireAdmin()
  if (typeof businessId !== "string" || !businessId.trim()) return []
  return db.select({
    id: automations.id, trigger: automations.trigger, on: automations.on,
    wording: automations.wording, buttons: automations.buttons,
    isDefault: automations.isDefault, updatedAt: automations.updatedAt,
  }).from(automations).where(eq(automations.businessId, businessId))
    .orderBy(asc(automations.createdAt), asc(automations.id))
}

export async function adminAutomationRuns(filter: {
  businessId?: string
  state?: AutomationRun["state"]
  search?: string
  cursor?: string
}): Promise<{ runs: BusinessAutomationRun[]; next: string | null }> {
  await requireAdmin()
  const empty = { runs: [], next: null }
  if (!validFilter(filter)) return empty
  const search = filter.search?.trim() ?? ""
  const cursor = filter.cursor ? readCursor(filter.cursor, filter, search) : null
  if (filter.cursor && !cursor) return empty
  const limit = WHATSAPP_ADMIN_RULES.listRows
  const rows = await db.select({
    id: automationRuns.id, automationId: automationRuns.automationId,
    customerPhone: automationRuns.customerPhone, customerName: automationRuns.customerName,
    step: automationRuns.step, state: automationRuns.state, reason: automationRuns.reason, at: automationRuns.at,
    businessId: automationRuns.businessId, businessName: businesses.name, timeZone: businesses.timezone,
  }).from(automationRuns).innerJoin(businesses, eq(businesses.id, automationRuns.businessId))
    .where(and(
      filter.businessId === undefined ? undefined : eq(automationRuns.businessId, filter.businessId),
      filter.state === undefined ? undefined : eq(automationRuns.state, filter.state),
      searchCondition(search),
      cursor ? or(lt(automationRuns.at, cursor.at), and(eq(automationRuns.at, cursor.at), lt(automationRuns.id, cursor.id))) : undefined,
    )).orderBy(desc(automationRuns.at), desc(automationRuns.id)).limit(limit + 1)
  const runs = rows.slice(0, limit)
  const last = runs.at(-1)
  const next = rows.length > limit && last ? Buffer.from(JSON.stringify({
    businessId: filter.businessId ?? null, state: filter.state ?? null, search, at: last.at, id: last.id,
  } satisfies Cursor)).toString("base64url") : null
  return { runs, next }
}
