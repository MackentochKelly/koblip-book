import "server-only"

import { and, count, eq, gte, inArray } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  businesses,
  notificationSends,
  notificationTimer,
} from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"

export type TimerHealth =
  | { state: "running" | "late"; lastRunAt: string; lastError: string | null }
  | { state: "never" }

export type ChatReach = "reachable" | "unreachable" | "notSet"

export interface WhatsappOverview {
  // When it was read, for "… ago".
  now: number
  // Waiting to go (pending or being sent now).
  waiting: number
  // Failed in the last WHATSAPP_ADMIN_RULES.failedDays days.
  failed: number
  timer: TimerHealth
  chat: ChatReach
  // Each server setting WhatsApp needs, and whether it is set.
  secrets: { name: string; set: boolean }[]
}

// Demo copies (features/demo) never send; they stay out of the counts.
const realBusiness = eq(businesses.isDemo, false)

function countSends(where: ReturnType<typeof and>) {
  return db
    .select({ n: count() })
    .from(notificationSends)
    .innerJoin(businesses, eq(businesses.id, notificationSends.businessId))
    .where(and(realBusiness, where))
}

async function timerHealth(now: number): Promise<TimerHealth> {
  const [[row], rules] = await Promise.all([
    db
      .select()
      .from(notificationTimer)
      .where(eq(notificationTimer.id, "timer"))
      .limit(1),
    notificationRules(),
  ])
  if (!row) return { state: "never" }
  const lateMs =
    rules.sendEverySeconds * WHATSAPP_ADMIN_RULES.timerLateAfterChecks * 1000
  const late = now - Date.parse(row.lastRunAt) > lateMs
  return {
    state: late ? "late" : "running",
    lastRunAt: row.lastRunAt,
    lastError: row.lastError,
  }
}

// Chat has no health route, so any answer from its API address counts:
// the server is up and in reach. Its sign-in is checked on Koblip number.
async function chatReach(): Promise<ChatReach> {
  const url = process.env.CHAT_API_URL
  if (!url) return "notSet"
  try {
    await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(WHATSAPP_ADMIN_RULES.chatCheckSeconds * 1000),
    })
    return "reachable"
  } catch {
    return "unreachable"
  }
}

export async function getWhatsappOverview(): Promise<WhatsappOverview> {
  await requireAdmin()
  const now = Date.now()
  const since = new Date(
    now - WHATSAPP_ADMIN_RULES.failedDays * 86_400_000
  ).toISOString()
  const [[waiting], [failed], timer, chat] = await Promise.all([
    countSends(inArray(notificationSends.state, ["pending", "sending"])),
    countSends(
      and(
        eq(notificationSends.state, "failed"),
        gte(notificationSends.updatedAt, since)
      )
    ),
    timerHealth(now),
    chatReach(),
  ])
  return {
    now,
    waiting: waiting.n,
    failed: failed.n,
    timer,
    chat,
    secrets: WHATSAPP_ADMIN_RULES.secrets.map((name) => ({
      name,
      set: !!process.env[name],
    })),
  }
}
