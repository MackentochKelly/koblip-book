import { WhatsappSoon } from "@/features/admin/components/whatsapp-soon"
import { getAdminMessages } from "@/features/admin/i18n/server"

export default async function WhatsappRulesPage() {
  return <WhatsappSoon part="rules" m={await getAdminMessages()} />
}
