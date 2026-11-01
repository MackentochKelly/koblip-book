import {
  WhatsappKoblipMessages,
  type KoblipEditorInfo,
} from "@/features/admin/components/whatsapp-koblip-messages"
import { koblipChatConnectionStatus } from "@/features/dashboard/api/chat-oauth"
import { koblipMessages, refreshKoblipTemplates } from "@/features/dashboard/api/chat-templates"
import { saveKoblipMessage, submitKoblipMessage } from "@/features/dashboard/api/koblip-template-actions"
import {
  exampleValues,
  messageButtonActions,
  messageFields,
} from "@/features/dashboard/utils/booking-templates"
import { requireAdmin } from "@/lib/dal"
import { notificationRules } from "@/lib/platform-settings"
import type { KoblipMessageName } from "@/types/koblip-messages"

// WhatsApp → Koblip messages (K2): Meta's latest review is read from Chat on
// every visit; nothing is submitted until the admin asks. The admin check
// comes first: the layout's runs alongside the page, not before it.
export default async function WhatsappKoblipMessagesPage() {
  await requireAdmin()
  await refreshKoblipTemplates()
  const [connection, messages, rules] = await Promise.all([
    koblipChatConnectionStatus(),
    koblipMessages(),
    notificationRules(),
  ])
  // What the shared editor needs of each message, from Book's templates.
  const info = Object.fromEntries(
    messages.map(({ message }) => [
      message,
      {
        fields: messageFields(message),
        buttonActions: messageButtonActions(message),
        examples: { en: exampleValues("en"), es: exampleValues("es") },
      },
    ])
  ) as Record<KoblipMessageName, KoblipEditorInfo>
  return (
    <WhatsappKoblipMessages
      messages={messages}
      connected={!!connection && !connection.needsReconnect}
      info={info}
      limits={{
        maxHeader: rules.maxHeader,
        maxBody: rules.maxBody,
        maxFooter: rules.maxFooter,
        maxButtons: rules.maxButtons,
        maxButtonLabel: rules.maxButtonLabel,
      }}
      save={saveKoblipMessage}
      submit={submitKoblipMessage}
    />
  )
}
