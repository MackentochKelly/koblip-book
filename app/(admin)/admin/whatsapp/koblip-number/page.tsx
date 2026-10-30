import { KoblipChatCard } from "@/features/admin/components/koblip-chat-card"
import { KoblipNumbers } from "@/features/admin/components/koblip-numbers"
import { getAdminMessages } from "@/features/admin/i18n/server"
import { koblipChatConnectionStatus } from "@/features/dashboard/api/chat-oauth"
import { disconnectKoblipChat } from "@/features/dashboard/api/koblip-chat-connection"
import { koblipChatNumbers } from "@/features/dashboard/api/koblip-chat-numbers"
import { requireAdmin } from "@/lib/dal"
import { CHAT_CONNECT_RESULTS } from "@/types/chat-connect"

type Props = {
  searchParams: Promise<{ chat?: string }>
}

// WhatsApp → Koblip number (A3): Koblip's own Koblip Chat connection (K1)
// and the numbers in its workspace, read from Chat after the admin check.
export default async function WhatsappKoblipNumberPage({
  searchParams,
}: Props) {
  await requireAdmin()
  const [connection, numbers, m, { chat }] = await Promise.all([
    koblipChatConnectionStatus(),
    koblipChatNumbers(),
    getAdminMessages(),
    searchParams,
  ])
  return (
    <div className="flex flex-col gap-6">
      <KoblipChatCard
        connection={connection}
        result={CHAT_CONNECT_RESULTS.find((value) => value === chat) ?? null}
        disconnect={disconnectKoblipChat}
      />
      {numbers && !connection?.needsReconnect && (
        <KoblipNumbers numbers={numbers} m={m} />
      )}
    </div>
  )
}
