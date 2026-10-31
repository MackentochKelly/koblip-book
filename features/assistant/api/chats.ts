import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { assistantConversations } from "@/lib/db/schema"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type {
  AssistantChat,
  AssistantChatSummary,
  AssistantMessage,
} from "../types"

export interface SaveChatInput {
  id: string
  businessId: string
  ownerId: string
  messages: AssistantMessage[]
}

function toSummary(
  row: typeof assistantConversations.$inferSelect
): AssistantChatSummary {
  return { id: row.id, title: row.title, updatedAt: row.updatedAt }
}

function toChat(
  row: typeof assistantConversations.$inferSelect
): AssistantChat {
  let messages: AssistantMessage[] = []
  try {
    const parsed: unknown = JSON.parse(row.messages)
    if (Array.isArray(parsed)) {
      messages = parsed as AssistantMessage[]
    }
  } catch {
    messages = []
  }
  return { id: row.id, title: row.title, messages }
}

// Newest first, at most recentChats. Only this owner's rows.
export async function listAssistantChats(
  businessId: string,
  ownerId: string
): Promise<AssistantChatSummary[]> {
  const rows = await db
    .select()
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.businessId, businessId),
        eq(assistantConversations.ownerId, ownerId)
      )
    )
    .orderBy(desc(assistantConversations.updatedAt))
    .limit(ASSISTANT_RULES.recentChats)
  return rows.map(toSummary)
}

// The chat, or null when it is missing or belongs to someone else.
export async function getAssistantChat(
  id: string,
  businessId: string,
  ownerId: string
): Promise<AssistantChat | null> {
  const [row] = await db
    .select()
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.id, id),
        eq(assistantConversations.businessId, businessId),
        eq(assistantConversations.ownerId, ownerId)
      )
    )
    .limit(1)
  return row ? toChat(row) : null
}

// Creates the chat or replaces its messages, in one write, so two saves
// of a new chat at the same moment cannot collide. The title comes from
// the first owner message and is set once, on create only. Returns false
// when the id belongs to another owner or business: never overwrite.
export async function saveAssistantChat(
  input: SaveChatInput
): Promise<boolean> {
  const firstOwner = input.messages.find((m) => m.role === "owner")
  const titleText = (firstOwner ?? input.messages[0])?.text ?? ""
  const messages = JSON.stringify(input.messages)
  // SQLite upsert: on an existing id, only this owner's and business's
  // row is updated (setWhere); a foreign row returns nothing.
  const saved = await db
    .insert(assistantConversations)
    .values({
      id: input.id,
      businessId: input.businessId,
      ownerId: input.ownerId,
      title: titleText.trim().slice(0, ASSISTANT_RULES.maxChatTitleChars),
      messages,
    })
    .onConflictDoUpdate({
      target: assistantConversations.id,
      set: { messages, updatedAt: new Date().toISOString() },
      setWhere: and(
        eq(assistantConversations.businessId, input.businessId),
        eq(assistantConversations.ownerId, input.ownerId)
      ),
    })
    .returning({ id: assistantConversations.id })
  return saved.length > 0
}

// True when a row was deleted. False when it is missing or belongs to
// someone else.
export async function deleteAssistantChat(
  id: string,
  businessId: string,
  ownerId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: assistantConversations.id })
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.id, id),
        eq(assistantConversations.businessId, businessId),
        eq(assistantConversations.ownerId, ownerId)
      )
    )
    .limit(1)
  if (!row) {
    return false
  }
  await db
    .delete(assistantConversations)
    .where(eq(assistantConversations.id, id))
  return true
}
