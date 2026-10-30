import { WhatsappSoon } from "@/features/admin/components/whatsapp-soon"
import { getAdminMessages } from "@/features/admin/i18n/server"

export default async function WhatsappKoblipMessagesPage() {
  return <WhatsappSoon part="koblip-messages" m={await getAdminMessages()} />
}
