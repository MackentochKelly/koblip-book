import { getWhatsappBusinesses } from "@/features/admin/api/whatsapp-businesses"
import { WhatsappBusinesses } from "@/features/admin/components/whatsapp-businesses"
import { getAdminMessages } from "@/features/admin/i18n/server"
import { businessChatConnections } from "@/features/dashboard/api/chat-oauth"

// WhatsApp → Businesses (A4).
export default async function WhatsappBusinessesPage() {
  const [businesses, connections, m] = await Promise.all([
    getWhatsappBusinesses(),
    businessChatConnections(),
    getAdminMessages(),
  ])
  return (
    <WhatsappBusinesses
      businesses={businesses}
      connections={connections}
      m={m}
    />
  )
}
