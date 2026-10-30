import { getWhatsappRules } from "@/features/admin/api/whatsapp-rules"
import { WhatsappRules } from "@/features/admin/components/whatsapp-rules"

// WhatsApp → Rules (A7).
export default async function WhatsappRulesPage() {
  return <WhatsappRules rules={await getWhatsappRules()} />
}
