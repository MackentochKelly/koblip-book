import { notFound } from "next/navigation"

import { getWhatsappBusiness } from "@/features/admin/api/whatsapp-businesses"
import { WhatsappBusiness } from "@/features/admin/components/whatsapp-business"
import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { disconnectBusinessChat } from "@/features/dashboard/api/koblip-chat-connection"
import {
  notificationMessagesFor,
  notificationSettingsFor,
} from "@/features/dashboard/api/notifications"

// WhatsApp → Businesses → one business (A4). Reads it with the business
// page's own code, after the admin check.
export default async function WhatsappBusinessPage({
  params,
}: PageProps<"/admin/whatsapp/businesses/[businessId]">) {
  const { businessId } = await params
  const business = await getWhatsappBusiness(businessId)
  if (!business) notFound()
  const [connection, messages, settings] = await Promise.all([
    chatConnectionFor(business.id),
    notificationMessagesFor(business.id),
    notificationSettingsFor(business.id),
  ])
  return (
    <WhatsappBusiness
      data={{ business, connection, messages, settings }}
      disconnect={disconnectBusinessChat}
    />
  )
}
