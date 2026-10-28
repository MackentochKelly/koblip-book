import "server-only"

import { db } from "@/lib/db"
import { assistantActions } from "@/lib/db/schema"

export interface AuditEntry {
  businessId: string
  ownerId: string
  tool: string
  summary: string // server-built one-liner, never model words
  status: "ok" | "failed"
}

// One audit row per write the assistant runs, including failures.
// A failed log write never breaks the user's action: short code only,
// no keys, phones, or provider text.
export async function logAssistantAction(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(assistantActions).values(entry)
  } catch {
    console.error("audit-log-failed")
  }
}
