import { getWhatsappOverview } from "@/features/admin/api/whatsapp-overview"
import { WhatsappOverview } from "@/features/admin/components/whatsapp-overview"

// WhatsApp → Overview (A2).
export default async function WhatsappOverviewPage() {
  return <WhatsappOverview overview={await getWhatsappOverview()} />
}
