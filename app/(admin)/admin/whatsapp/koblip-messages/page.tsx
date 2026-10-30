import { WhatsappKoblipMessages } from "@/features/admin/components/whatsapp-koblip-messages"
import { koblipChatConnectionStatus } from "@/features/dashboard/api/chat-oauth"
import { koblipMessages, refreshKoblipTemplates } from "@/features/dashboard/api/chat-templates"
import { submitKoblipMessage } from "@/features/dashboard/api/koblip-template-actions"

// WhatsApp → Koblip messages (K2): Meta's latest review is read from Chat on
// every visit; nothing is submitted until the admin asks.
export default async function WhatsappKoblipMessagesPage() {
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
