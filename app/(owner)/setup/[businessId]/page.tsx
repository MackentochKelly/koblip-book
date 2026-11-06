import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { GlassCard } from "@/components/glass-frame"
import { Toaster } from "@/components/ui/sonner"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { requireAccount } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { isMetaAiEnabled } from "@/lib/meta-ai"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell.titles")
  return { title: t("checkDetails") }
}

// Right after sign-up: the owner checks and fixes what came from Google
// Maps, and Continue (which saves and confirms the details) moves on to
// getting the page ready. A plain
// page: Safari can't run a moving gradient under its own bars.
export default async function SetupPage({
  params,
}: PageProps<"/setup/[businessId]">) {
  const { businessId } = await params
  const owner = await requireAccount(`/setup/${businessId}`)
  const { business, team } = await getOwnerBusiness(businessId)
  const t = await getTranslations("owner.shell.titles")
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
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 pb-24">
        <GlassCard>
          <DetailsForm
            businessId={businessId}
            hasTeam={team.length > 0}
            title={t("checkDetails")}
            next={`/setup/${businessId}/preparing`}
            canImprove={isMetaAiEnabled()}
            details={{
              name: business.name,
              address: business.address,
              description: business.description,
              phone: business.phone,
              website: business.website,
              seats: business.seats,
            }}
          />
        </GlassCard>
      </main>
      <Toaster />
    </div>
  )
}
