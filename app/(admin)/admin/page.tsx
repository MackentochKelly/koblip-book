import { LayoutDashboardIcon } from "@/components/ui/icons"
import { getOverview } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { KoblipChatCard } from "@/features/admin/components/koblip-chat-card"
import { OverviewCards } from "@/features/admin/components/overview-cards"
import { getAdminMessages } from "@/features/admin/i18n/server"
import { koblipChatConnectionStatus } from "@/features/dashboard/api/chat-oauth"
import { disconnectKoblipChat } from "@/features/dashboard/api/koblip-chat-connection"
import { CHAT_CONNECT_RESULTS } from "@/types/chat-connect"

type Props = {
  searchParams: Promise<{ chat?: string }>
}

export default async function AdminOverviewPage({ searchParams }: Props) {
  const [overview, connection, m, { chat }] = await Promise.all([
    getOverview(),
    koblipChatConnectionStatus(),
    getAdminMessages(),
    searchParams,
  ])
  return (
    <AdminPage title={m.nav.overview} icon={<LayoutDashboardIcon />} empty={null}>
      <div className="flex flex-col gap-6">
        <OverviewCards overview={overview} m={m} />
        <KoblipChatCard
          connection={connection}
          result={CHAT_CONNECT_RESULTS.find((value) => value === chat) ?? null}
          disconnect={disconnectKoblipChat}
        />
      </div>
    </AdminPage>
  )
}
