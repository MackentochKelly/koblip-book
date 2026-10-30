import type { Metadata } from "next"

import { ChatConnectDone } from "@/features/dashboard/components/chat-connect-done"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import {
  CHAT_CONNECT_RESULTS,
  type ChatConnectResult,
} from "@/types/chat-connect"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).integrations.koblipChat.name }
}

type Props = {
  searchParams: Promise<{ businessId?: string; for?: string; result?: string }>
}

// Where the Koblip Chat window ends (app/api/chat/callback sends it here).
export default async function ChatConnectDonePage({ searchParams }: Props) {
  const { businessId, for: account, result } = await searchParams
  const known = CHAT_CONNECT_RESULTS.find((value) => value === result)
  return (
    <ChatConnectDone
      businessId={businessId ?? ""}
      koblip={account === "koblip"}
      result={known ?? ("failed" satisfies ChatConnectResult)}
    />
  )
}
