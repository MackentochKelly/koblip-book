import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { koblipChatConnection } from "@/lib/db/schema"
import { koblipChatApi } from "./chat-oauth"

type Connections = {
  data?: {
    id: string
    is_active?: boolean
    account_review_status?: string | null
    phone_numbers?: {
      id: string
      display_phone_number?: string | null
      verified_name?: string | null
      quality_rating?: string | null
      status?: string | null
      is_active?: boolean
    }[]
  }[]
}

export type KoblipNumber = {
  id: string
  number: string | null
  name: string | null
  quality: string | null
  // Meta's review of the WhatsApp account the number is in.
  accountReview: string | null
  active: boolean
  // The one the sender uses (the connection's saved number, K3).
  sending: boolean
}

// The WhatsApp numbers in Koblip's own workspace, as Chat lists them now
// (A3), for the admin's Koblip number screen. Null when Koblip's workspace is
// not connected; "unreachable" when Chat does not answer.
export async function koblipChatNumbers(): Promise<
  KoblipNumber[] | "unreachable" | null
> {
  const [connection] = await db
    .select({ phoneNumberId: koblipChatConnection.phoneNumberId })
    .from(koblipChatConnection)
    .where(eq(koblipChatConnection.id, "koblip"))
    .limit(1)
  if (!connection) return null
  let list: Connections
  try {
    list = await koblipChatApi<Connections>("/api/whatsapp/connections")
  } catch {
    return "unreachable"
  }
  return (list.data ?? []).flatMap((account) =>
    (account.phone_numbers ?? []).map((phone) => ({
      id: phone.id,
      number: phone.display_phone_number ?? null,
      name: phone.verified_name ?? null,
      quality: phone.quality_rating ?? null,
      accountReview: account.account_review_status ?? null,
      active: account.is_active !== false && phone.is_active !== false,
      sending: phone.id === connection.phoneNumberId,
    }))
  )
}
