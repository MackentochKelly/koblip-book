import { getWhatsappBusinesses } from "@/features/admin/api/whatsapp-businesses"
import { WhatsappBusinesses } from "@/features/admin/components/whatsapp-businesses"
import { businessChatConnections } from "@/features/dashboard/api/chat-oauth"

// WhatsApp → Businesses (A4).
export default async function WhatsappBusinessesPage() {
  const [businesses, connections] = await Promise.all([
    getWhatsappBusinesses(),
    businessChatConnections(),
  ])
  return (
    <WhatsappBusinesses businesses={businesses} connections={connections} />
  )
}
