import { WhatsappSoon } from "@/features/admin/components/whatsapp-soon"
import { getAdminMessages } from "@/features/admin/i18n/server"

export default async function WhatsappWindowPage() {
  return <WhatsappSoon part="window" m={await getAdminMessages()} />
}
