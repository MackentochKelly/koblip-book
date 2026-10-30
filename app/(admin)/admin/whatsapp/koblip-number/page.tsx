import { KoblipChatCard } from "@/features/admin/components/koblip-chat-card"
import { koblipChatConnectionStatus } from "@/features/dashboard/api/chat-oauth"
import { disconnectKoblipChat } from "@/features/dashboard/api/koblip-chat-connection"
import { CHAT_CONNECT_RESULTS } from "@/types/chat-connect"

type Props = {
  searchParams: Promise<{ chat?: string }>
}

// Koblip's own Koblip Chat connection (K1); A3 adds its number and review.
export default async function WhatsappKoblipNumberPage({ searchParams }: Props) {
  const [connection, { chat }] = await Promise.all([koblipChatConnectionStatus(), searchParams])
  return (
    <KoblipChatCard
      connection={connection}
      result={CHAT_CONNECT_RESULTS.find((value) => value === chat) ?? null}
      disconnect={disconnectKoblipChat}
    />
  )
}
