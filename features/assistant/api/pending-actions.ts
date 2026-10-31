import "server-only"

import { and, count, eq, lte } from "drizzle-orm"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { db } from "@/lib/db"
import { assistantPendingActions } from "@/lib/db/schema"
import { runInTurn } from "@/lib/run-in-turn"

// Pending risky actions: stored when the model asks, run only after the
// owner's tap. In the database, so a deploy or restart never turns a card
// into "expired".
export interface PendingAction {
  id: string
  ownerId: string
  businessId: string
  toolName: string
  args: unknown
  createdAt: number // ms since epoch
}

type Row = typeof assistantPendingActions.$inferSelect

function toAction(row: Row): PendingAction {
  let args: unknown = null
  try {
    args = JSON.parse(row.args)
  } catch {
    args = null
  }
  return {
    id: row.id,
    ownerId: row.ownerId,
    businessId: row.businessId,
    toolName: row.toolName,
    args,
    createdAt: Date.parse(row.createdAt),
  }
}

// Cards made at or before this moment have expired.
function cutoff(now: number): string {
  return new Date(now - ASSISTANT_RULES.pendingActionExpiresMs).toISOString()
}

// Stores a card, at most maxPendingActionsPerOwner live per owner. Expired
// cards of every owner are removed first. One owner's stores take turns,
// so two at once cannot both pass the cap.
export async function storePendingAction(
  input: Omit<PendingAction, "id" | "createdAt">,
  now = Date.now()
): Promise<{ id: string } | { error: "too_many" }> {
  return runInTurn(`pending-action:${input.ownerId}`, async () => {
    await db
      .delete(assistantPendingActions)
      .where(lte(assistantPendingActions.createdAt, cutoff(now)))
    const [{ live }] = await db
      .select({ live: count() })
      .from(assistantPendingActions)
      .where(eq(assistantPendingActions.ownerId, input.ownerId))
    if (live >= ASSISTANT_RULES.maxPendingActionsPerOwner) {
      return { error: "too_many" as const }
    }
    const id = crypto.randomUUID()
    await db.insert(assistantPendingActions).values({
      id,
      ownerId: input.ownerId,
      businessId: input.businessId,
      toolName: input.toolName,
      args: JSON.stringify(input.args ?? null),
      createdAt: new Date(now).toISOString(),
    })
    return { id }
  })
}

// Look without taking.
export async function peekPendingAction(
  id: string
): Promise<PendingAction | null> {
  const [row] = await db
    .select()
    .from(assistantPendingActions)
    .where(eq(assistantPendingActions.id, id))
    .limit(1)
  return row ? toAction(row) : null
}

// Takes the card for running. Single use: one delete decides, so a double
// tap runs it once. "expired" for unknown, expired (then removed) or
// already taken; "not_allowed" for another owner's or business's card,
// which stays stored.
export async function takePendingAction(
  id: string,
  ownerId: string,
  businessId: string,
  now = Date.now()
): Promise<PendingAction | "expired" | "not_allowed"> {
  const found = await peekPendingAction(id)
  if (!found) return "expired"
  if (found.createdAt <= Date.parse(cutoff(now))) {
    await db
      .delete(assistantPendingActions)
      .where(eq(assistantPendingActions.id, id))
    return "expired"
  }
  if (found.ownerId !== ownerId || found.businessId !== businessId) {
    return "not_allowed"
  }
  const [taken] = await db
    .delete(assistantPendingActions)
    .where(
      and(
        eq(assistantPendingActions.id, id),
        eq(assistantPendingActions.ownerId, ownerId),
        eq(assistantPendingActions.businessId, businessId)
      )
    )
    .returning()
  return taken ? toAction(taken) : "expired"
}
