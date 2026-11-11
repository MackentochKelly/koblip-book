import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { googleCalendarFor } from "@/features/dashboard/api/google-calendar"
import { senderFor } from "@/features/dashboard/api/notification-sender"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { IntegrationsView } from "@/features/dashboard/components/integrations-view"
import { hasFeature } from "@/lib/plan-access"
import { stripeConnect, stripeStateOf } from "@/lib/stripe-connect"
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
  const { business, team } = await getOwnerBusiness(businessId)
  const [connection, googleCalendar, sender, hasCards] = await Promise.all([
    chatConnectionFor(businessId),
    googleCalendarFor(businessId),
    senderFor(businessId),
    hasFeature(business.id, "onlinePayments"),
  ])
  // Online payments (docs/plans/online-payments.md): where the app has
  // them and the business is real. On a plan without them the row still
  // leads to Settings, Payments, which says which plan has them.
  const stripe =
    stripeConnect !== null && !business.isDemo
      ? hasCards
        ? stripeStateOf(business)
        : "none"
      : null
  return (
    <IntegrationsView
      businessId={businessId}
      connection={connection}
      sender={sender}
      result={CHAT_CONNECT_RESULTS.find((value) => value === chat) ?? null}
      googleCalendar={googleCalendar}
      googleResult={GOOGLE_CONNECT_RESULTS.find((value) => value === google) ?? null}
      team={team.map((member) => ({ id: member.id, name: member.name }))}
      stripe={stripe}
    />
  )
}
