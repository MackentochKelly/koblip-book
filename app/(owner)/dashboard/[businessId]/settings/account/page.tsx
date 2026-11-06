import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getVoiceChoice } from "@/features/assistant/api/voice-choice"
import { VoiceSection } from "@/features/assistant/components/voice-section"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DeleteAccountSection } from "@/components/delete-account-section"
import { deleteAccount } from "@/features/dashboard/api/delete-actions"
import { requireAccount } from "@/lib/dal"
import { languageOf } from "@/lib/page-language"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.settings")
  return { title: t("parts.account") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function AccountPage({ params }: Props) {
  const { businessId } = await params
  const returnTo = `/dashboard/${businessId}/settings/account`
  const [owner, , locale] = await Promise.all([
    requireAccount(returnTo),
    getOwnerBusiness(businessId),
    getLocale(),
  ])
  const language = languageOf(locale)
  const voiceChoice = await getVoiceChoice(owner.userId)
  const t = await getTranslations("owner.settings.account")
  return (
    <div className="flex flex-col gap-10">
      <VoiceSection language={language} voiceChoice={voiceChoice} />
      <DeleteAccountSection
        contact={owner.contact}
        returnTo={returnTo}
        deleteAccount={deleteAccount}
        hint={t("deleteHint")}
        confirmText={t("confirmText")}
      />
    </div>
  )
}
