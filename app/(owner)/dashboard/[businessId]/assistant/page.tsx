import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getVoiceChoice } from "@/features/assistant/api/voice-choice"
import { AssistantChat } from "@/features/assistant/components/assistant-chat"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { PlanLocked } from "@/components/plan-locked"
import { requireOwner } from "@/lib/dal"
import { hasFeature } from "@/lib/plan-access"
import { languageOf } from "@/lib/page-language"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assistant")
  return { title: t("title") }
}

export default async function AssistantPage({
  params,
}: PageProps<"/dashboard/[businessId]/assistant">) {
  const { businessId } = await params
  const [owner] = await Promise.all([
    requireOwner(`/dashboard/${businessId}/assistant`),
    getOwnerBusiness(businessId),
  ])
  if (!(await hasFeature(businessId, "assistantChat"))) {
    return <PlanLocked feature="assistantChat" />
  }
  // A talk hears and speaks in the owner's language.
  const language = languageOf(await getLocale())
  const voiceChoice = await getVoiceChoice(owner.userId)
  return (
    <AssistantChat
      businessId={businessId}
      language={language}
      voiceChoice={voiceChoice}
    />
  )
}
