import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { senderFor } from "@/features/dashboard/api/notification-sender"
import { WhatsappFrame } from "@/features/dashboard/components/whatsapp-frame"

// The WhatsApp page's frame: tabs on a computer, a list on a phone. Each
// part is a route below it (docs/plans/whatsapp-notifications.md, P1).
export default async function WhatsappLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/notifications">) {
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
