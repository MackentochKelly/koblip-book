import { getWhatsappOverview } from "@/features/admin/api/whatsapp-overview"
import { WhatsappOverview } from "@/features/admin/components/whatsapp-overview"
import { getAdminMessages } from "@/features/admin/i18n/server"

// WhatsApp → Overview (A2).
export default async function WhatsappOverviewPage() {
  const [overview, m] = await Promise.all([
    getWhatsappOverview(),
    getAdminMessages(),
  ])
  return <WhatsappOverview overview={overview} m={m} />
}
