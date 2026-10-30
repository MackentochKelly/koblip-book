import { getWhatsappUsage } from "@/features/admin/api/whatsapp-usage"
import { WhatsappUsage } from "@/features/admin/components/whatsapp-usage"

// WhatsApp → Usage (A8).
export default async function WhatsappUsagePage() {
  return <WhatsappUsage usage={await getWhatsappUsage()} />
}
