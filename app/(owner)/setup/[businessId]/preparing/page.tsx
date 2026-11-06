import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { after } from "next/server"

import { GlassCard } from "@/components/glass-frame"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { startPreparing } from "@/features/starter-catalog/api/prepare-jobs"
import { PreparingCard } from "@/features/starter-catalog/components/preparing-card"
import { starterMessagesFor } from "@/features/starter-catalog/i18n"
import { requireAccount } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { translateBusinessNow } from "@/lib/translations/business-texts"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  return { title: starterMessagesFor(await getOwnerLanguage()).title }
}

// Between "Check your details" and "Your page is live": Meta AI fills the
// new page (services, extras, prices, team and their photos), then the
// success page opens by itself. Same plain page and top bar as the
// steps around it.
export default async function PreparingPage({
  params,
}: PageProps<"/setup/[businessId]/preparing">) {
  const { businessId } = await params
  const owner = await requireAccount(`/setup/${businessId}/preparing`)
  const { business } = await getOwnerBusiness(businessId)
  if (business.setupFinishedAt !== null) {
    redirect(`/setup/${businessId}/ready`)
  }
  // The page's translations, on the server, nobody waiting: it joins the
  // work started on the Google details screen, and sends Google what the
  // owner changed on "Check your details" since.
  after(() =>
    startPreparing(business, () => translateBusinessNow(business.id))
  )
  const language = await getOwnerLanguage()
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background",
        fontDisplay.variable
      )}
    >
      <TopBar
        viewPage={false}
        business={business}
        owner={{ name: owner.name, contact: owner.contact, image: owner.image }}
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 pt-6 pb-24">
        <GlassCard>
          <PreparingCard
            businessId={businessId}
            language={language}
            readyHref={`/setup/${businessId}/ready`}
          />
        </GlassCard>
      </main>
    </div>
  )
}
