import "server-only"
import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { automationEvents, automationPauses } from "@/lib/db/schema"
import type { AutomationEvent } from "../utils/automation-events"

export function automationCustomerWhere(businessId: string, phoneNumberId: string, event: AutomationEvent) {
  return and(
    eq(automationPauses.businessId, businessId),
    eq(automationPauses.workspaceId, event.workspaceId),
    eq(automationPauses.phoneNumberId, phoneNumberId),
    eq(automationPauses.customerPhone, event.customerPhone)
  )
}

// The insert is the claim: a duplicate never reaches a side effect, including
// when two webhook deliveries arrive at once or after a process restart.
export async function claimAutomationEvent(businessId: string, phoneNumberId: string, event: AutomationEvent) {
  const claimed = await db.insert(automationEvents).values({
    businessId, workspaceId: event.workspaceId, phoneNumberId,
    eventId: event.eventId, occurredAt: event.at,
  }).onConflictDoNothing().returning({ eventId: automationEvents.eventId })
  return claimed.length !== 0
}

export function pauseAutomationCustomer(businessId: string, phoneNumberId: string, event: AutomationEvent, quietHours: number) {
  const until = new Date(Date.parse(event.at) + quietHours * 60 * 60 * 1000).toISOString()
  return db.insert(automationPauses).values({
    businessId, workspaceId: event.workspaceId, phoneNumberId,
    customerPhone: event.customerPhone, until,
  }).onConflictDoUpdate({
    target: [automationPauses.businessId, automationPauses.workspaceId, automationPauses.phoneNumberId, automationPauses.customerPhone],
    set: { until: sql`max(${automationPauses.until}, excluded.until)` },
  })
}

// A callback can arrive before Chat's send response. Keep active sends only
// while running, then use a durable receipt rather than guessing from timing.
const sending = new Map<string, Set<Promise<void>>>()

export async function duringBookSend<T>(workspaceId: string, send: () => Promise<T>): Promise<T> {
  let done!: () => void
  const pending = new Promise<void>((resolve) => { done = resolve })
  const active = sending.get(workspaceId) ?? new Set<Promise<void>>()
  active.add(pending)
  sending.set(workspaceId, active)
  try { return await send() } finally {
    active.delete(pending)
    if (!active.size) sending.delete(workspaceId)
    done()
  }
}

export async function waitForBookSends(workspaceId: string) {
  await Promise.all([...(sending.get(workspaceId) ?? [])])
}

export function bookSendReceipt(recordId: string) {
  return JSON.stringify(["book-send", recordId])
}
