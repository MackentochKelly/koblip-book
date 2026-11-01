import "server-only"
import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm"

import { db } from "@/lib/db"
import { automationRuns as runsTable } from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import type { Automation, AutomationRun } from "../types/automations"
import { readAutomations } from "./automation-data"
import { getOwnerBusiness } from "./queries"

type RunFilter = { automationId?: string; state?: AutomationRun["state"]; search?: string; cursor?: string }
type Cursor = {
  businessId: string
  automationId: string | null
  state: AutomationRun["state"] | null
  search: string
  at: string
  id: string
}

function validFilter(filter: RunFilter): boolean {
  return !!filter && typeof filter === "object" && !Array.isArray(filter) &&
    Object.keys(filter).every((key) => ["automationId", "state", "search", "cursor"].includes(key)) &&
    (filter.automationId === undefined || (typeof filter.automationId === "string" && !!filter.automationId.trim())) &&
    (filter.state === undefined || ["sent", "failed", "skipped"].includes(filter.state)) &&
    (filter.search === undefined || typeof filter.search === "string") &&
    (filter.cursor === undefined || (typeof filter.cursor === "string" && !!filter.cursor))
}

function readCursor(value: string, businessId: string, filter: RunFilter): Cursor | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
    const bytes = Buffer.from(value, "base64url")
    if (bytes.toString("base64url") !== value) return null
    const cursor: unknown = JSON.parse(bytes.toString("utf8"))
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return null
    const row = cursor as Record<string, unknown>
    if (row.businessId !== businessId || row.automationId !== (filter.automationId ?? null) ||
      row.state !== (filter.state ?? null) || row.search !== (filter.search?.trim() ?? "") || typeof row.at !== "string" ||
      typeof row.id !== "string" || !row.id || new Date(row.at).toISOString() !== row.at) return null
    return row as Cursor
  } catch {
    return null
  }
}

// Match Activity: name in any case, or the digits of a formatted phone.
// LIKE wildcards are escaped so a customer's literal name remains searchable.
function searchCondition(search: string | undefined): SQL | undefined {
  const text = search?.trim()
  if (!text) return undefined
  const contains = (value: string) => `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
  const byName = sql`${runsTable.customerName} like ${contains(text)} escape '\\'`
  const digits = text.replace(/\D/g, "")
  return digits ? or(byName, sql`${runsTable.customerPhone} like ${contains(digits)} escape '\\'`) : byName
}

export async function automationsFor(businessId: string): Promise<Automation[]> {
  await getOwnerBusiness(businessId)
  return readAutomations(businessId)
}

export async function automationRuns(
  businessId: string,
  filter: { automationId?: string; state?: AutomationRun["state"]; search?: string; cursor?: string }
): Promise<{ runs: AutomationRun[]; next: string | null }> {
  await getOwnerBusiness(businessId)
  const empty = { runs: [], next: null }
  if (!validFilter(filter)) return empty
  const cursor = filter.cursor ? readCursor(filter.cursor, businessId, filter) : null
  if (filter.cursor && !cursor) return empty
  const { historySize } = await notificationRules(businessId)
  const rows = await db.select({
    id: runsTable.id,
    automationId: runsTable.automationId,
    customerPhone: runsTable.customerPhone,
    customerName: runsTable.customerName,
    step: runsTable.step,
    state: runsTable.state,
    reason: runsTable.reason,
    at: runsTable.at,
  }).from(runsTable).where(and(
    eq(runsTable.businessId, businessId),
    filter.automationId === undefined ? undefined : eq(runsTable.automationId, filter.automationId),
    filter.state === undefined ? undefined : eq(runsTable.state, filter.state),
    searchCondition(filter.search),
    cursor ? or(lt(runsTable.at, cursor.at), and(eq(runsTable.at, cursor.at), lt(runsTable.id, cursor.id))) : undefined,
  )).orderBy(desc(runsTable.at), desc(runsTable.id)).limit(historySize + 1)
  const runs = rows.slice(0, historySize)
  const last = runs.at(-1)
  const next = rows.length > historySize && last
    ? Buffer.from(JSON.stringify({ businessId, automationId: filter.automationId ?? null,
      state: filter.state ?? null, search: filter.search?.trim() ?? "", at: last.at, id: last.id } satisfies Cursor)).toString("base64url")
    : null
  return { runs, next }
}
