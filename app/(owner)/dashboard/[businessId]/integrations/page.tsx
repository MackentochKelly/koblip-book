import type { Metadata } from "next"
import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { IntegrationsView } from "@/features/dashboard/components/integrations-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { CHAT_CONNECT_RESULTS } from "@/features/dashboard/types/chat-connection"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.integrations }
}

type Props = {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ chat?: string }>
}

export default async function IntegrationsPage({ params, searchParams }: Props) {
  const { businessId } = await params
  const { chat } = await searchParams
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const connection = await chatConnectionFor(businessId)
  return (
    <IntegrationsView
      businessId={businessId}
      connection={connection}
      result={CHAT_CONNECT_RESULTS.find((value) => value === chat) ?? null}
    />
  )
}
