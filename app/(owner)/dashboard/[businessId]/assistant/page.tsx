import type { Metadata } from "next"
import { assistantMessagesFor } from "@/features/assistant/i18n"
import { AssistantChat } from "@/features/assistant/components/assistant-chat"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: assistantMessagesFor(await getOwnerLanguage()).title,
  }
}

export default async function AssistantPage({
  params,
}: PageProps<"/dashboard/[businessId]/assistant">) {
  const { businessId } = await params
  await getOwnerBusiness(businessId)
  const messages = assistantMessagesFor(await getOwnerLanguage())
  return <AssistantChat businessId={businessId} messages={messages} />
}
