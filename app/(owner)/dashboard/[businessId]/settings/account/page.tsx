import type { Metadata } from "next"
import { getVoiceChoice } from "@/features/assistant/api/voice-choice"
import { VoiceSection } from "@/features/assistant/components/voice-section"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { AccountSection } from "@/features/dashboard/components/account-section"
import {
  getOwnerLanguage,
  getOwnerMessages,
} from "@/features/dashboard/i18n/server"
import { requireAccount } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).settings.parts.account }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function AccountPage({ params }: Props) {
  const { businessId } = await params
  const returnTo = `/dashboard/${businessId}/settings/account`
  const [owner, , language] = await Promise.all([
    requireAccount(returnTo),
    getOwnerBusiness(businessId),
    getOwnerLanguage(),
  ])
  const voiceChoice = await getVoiceChoice(owner.userId)
  return (
    <div className="flex flex-col gap-10">
      <VoiceSection language={language} voiceChoice={voiceChoice} />
      <AccountSection contact={owner.contact} returnTo={returnTo} />
    </div>
  )
}
