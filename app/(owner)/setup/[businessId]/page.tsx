import type { Metadata } from "next"

import { GlassCard } from "@/components/glass-frame"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { requireOwner } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.titles.checkDetails }
}

// Right after sign-up: the owner checks and fixes what came from Google
// Maps, and Save (which confirms the details) opens the dashboard. A plain
// page: Safari can't run a moving gradient under its own bars.
export default async function SetupPage({
  params,
}: PageProps<"/setup/[businessId]">) {
  const { businessId } = await params
  const owner = await requireOwner(`/setup/${businessId}`)
  const { business, team } = await getOwnerBusiness(businessId)
  const m = await getOwnerMessages()
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
        owner={{ name: owner.name, email: owner.email, image: owner.image }}
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 pb-24">
        <GlassCard>
          <DetailsForm
            businessId={businessId}
            hasTeam={team.length > 0}
            title={m.shell.titles.checkDetails}
            next={`/setup/${businessId}/ready`}
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
    </div>
  )
}
