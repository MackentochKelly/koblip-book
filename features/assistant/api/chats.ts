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

// Creates the chat or replaces its messages. The title comes from the
// first owner message and is set once, on create only. Returns false
// when the id belongs to another owner or business: never overwrite.
export async function saveAssistantChat(
  input: SaveChatInput
): Promise<boolean> {
  const [row] = await db
    .select({
      id: assistantConversations.id,
      businessId: assistantConversations.businessId,
      ownerId: assistantConversations.ownerId,
    })
    .from(assistantConversations)
    .where(eq(assistantConversations.id, input.id))
    .limit(1)
  if (row) {
    if (row.businessId !== input.businessId || row.ownerId !== input.ownerId) {
      return false
    }
    await db
      .update(assistantConversations)
      .set({
        messages: JSON.stringify(input.messages),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(assistantConversations.id, input.id))
    return true
  }
  const firstOwner = input.messages.find((m) => m.role === "owner")
  const titleText = (firstOwner ?? input.messages[0])?.text ?? ""
  await db.insert(assistantConversations).values({
    id: input.id,
    businessId: input.businessId,
    ownerId: input.ownerId,
    title: titleText.trim().slice(0, ASSISTANT_RULES.maxChatTitleChars),
    messages: JSON.stringify(input.messages),
  })
  return true
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
