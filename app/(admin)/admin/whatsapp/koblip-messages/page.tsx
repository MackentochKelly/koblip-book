import { WhatsappKoblipMessages } from "@/features/admin/components/whatsapp-koblip-messages"
import { koblipChatConnectionStatus } from "@/features/dashboard/api/chat-oauth"
import { koblipMessages, refreshKoblipTemplates } from "@/features/dashboard/api/chat-templates"
import { submitKoblipMessage } from "@/features/dashboard/api/koblip-template-actions"
import { requireAdmin } from "@/lib/dal"

// WhatsApp → Koblip messages (K2): Meta's latest review is read from Chat on
// every visit; nothing is submitted until the admin asks. The admin check
// comes first: the layout's runs alongside the page, not before it.
export default async function WhatsappKoblipMessagesPage() {
  await requireAdmin()
  await refreshKoblipTemplates()
  const [connection, messages] = await Promise.all([koblipChatConnectionStatus(), koblipMessages()])
  return (
    <WhatsappKoblipMessages
      messages={messages}
      connected={!!connection && !connection.needsReconnect}
      submit={submitKoblipMessage}
    />
  )
}
