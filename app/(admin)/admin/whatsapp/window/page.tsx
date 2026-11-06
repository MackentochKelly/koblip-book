import { getWhatsappWindow } from "@/features/admin/api/whatsapp-window"
import { WhatsappWindow } from "@/features/admin/components/whatsapp-window"

// WhatsApp → 24-hour window (A6).
export default async function WhatsappWindowPage() {
  return <WhatsappWindow list={await getWhatsappWindow()} />
}
