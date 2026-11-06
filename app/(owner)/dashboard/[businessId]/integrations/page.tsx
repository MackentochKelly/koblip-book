import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { googleCalendarFor } from "@/features/dashboard/api/google-calendar"
import { senderFor } from "@/features/dashboard/api/notification-sender"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { IntegrationsView } from "@/features/dashboard/components/integrations-view"
import { CHAT_CONNECT_RESULTS } from "@/types/chat-connect"
import { GOOGLE_CONNECT_RESULTS } from "@/types/google-calendar-connect"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.integrations") }
}

type Props = {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ chat?: string; google?: string }>
}

export default async function IntegrationsPage({ params, searchParams }: Props) {
  const { businessId } = await params
  const { chat, google } = await searchParams
  // Only the business's owner gets here.
  const { team } = await getOwnerBusiness(businessId)
  const [connection, googleCalendar, sender] = await Promise.all([
    chatConnectionFor(businessId),
    googleCalendarFor(businessId),
    senderFor(businessId),
  ])
  return (
    <IntegrationsView
      businessId={businessId}
      connection={connection}
      sender={sender}
      result={CHAT_CONNECT_RESULTS.find((value) => value === chat) ?? null}
      googleCalendar={googleCalendar}
      googleResult={GOOGLE_CONNECT_RESULTS.find((value) => value === google) ?? null}
      team={team.map((member) => ({ id: member.id, name: member.name }))}
    />
  )
}
