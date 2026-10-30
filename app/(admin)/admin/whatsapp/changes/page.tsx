import { getWhatsappChanges } from "@/features/admin/api/whatsapp-changes"
import { WhatsappChanges } from "@/features/admin/components/whatsapp-changes"
import { getAdminMessages } from "@/features/admin/i18n/server"

// WhatsApp → Change log (A7).
export default async function WhatsappChangesPage() {
  const [changes, m] = await Promise.all([
    getWhatsappChanges(),
    getAdminMessages(),
  ])
  return <WhatsappChanges changes={changes} m={m} />
}
