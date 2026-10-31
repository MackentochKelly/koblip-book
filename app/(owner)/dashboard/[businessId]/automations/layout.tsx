import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { senderFor } from "@/features/dashboard/api/notification-sender"
import { WhatsappFrame } from "@/features/dashboard/components/whatsapp-frame"

// The WhatsApp page's frame: tabs, pinned under the top bar on a phone. Each
// part is a route below it (docs/plans/whatsapp-notifications.md, P1).
export default async function WhatsappLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/automations">) {
  const { businessId } = await params
  const [connection, sender] = await Promise.all([
    chatConnectionFor(businessId),
    senderFor(businessId),
  ])
  return (
    <WhatsappFrame businessId={businessId} connection={connection} sender={sender}>
      {children}
    </WhatsappFrame>
  )
}
