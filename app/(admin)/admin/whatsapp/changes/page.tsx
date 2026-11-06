import { getWhatsappChanges } from "@/features/admin/api/whatsapp-changes"
import { WhatsappChanges } from "@/features/admin/components/whatsapp-changes"

// WhatsApp → Change log (A7).
export default async function WhatsappChangesPage() {
  return <WhatsappChanges changes={await getWhatsappChanges()} />
}
