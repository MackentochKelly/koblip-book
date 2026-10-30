import { getWhatsappWindow } from "@/features/admin/api/whatsapp-window"
import { WhatsappWindow } from "@/features/admin/components/whatsapp-window"
import { getAdminMessages } from "@/features/admin/i18n/server"

// WhatsApp → 24-hour window (A6).
export default async function WhatsappWindowPage() {
  const [list, m] = await Promise.all([getWhatsappWindow(), getAdminMessages()])
  return <WhatsappWindow list={list} m={m} />
}
