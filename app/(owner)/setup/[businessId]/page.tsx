import type { Metadata } from "next"

import { GlassCard } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { SiteHeader } from "@/components/site-header"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { requireOwner } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Check your details" }

// Right after sign-up: the owner checks and fixes what came from Google
// Maps, and Save (which confirms the details) opens the dashboard. The
// login page's moving gradient, here filling the whole screen.
export default async function SetupPage({
  params,
}: PageProps<"/setup/[businessId]">) {
  const { businessId } = await params
  await requireOwner(`/setup/${businessId}`)
  const { business, team } = await getOwnerBusiness(businessId)
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background",
        fontDisplay.variable
      )}
    >
      <section className="relative isolate flex flex-1 flex-col overflow-hidden">
        <HeroGradient className="[clip-path:none]" />
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-2 pt-4 pb-24 sm:px-4">
          <GlassCard>
            <DetailsForm
              businessId={businessId}
              hasTeam={team.length > 0}
              title="Check your details"
              next={`/dashboard/${businessId}?welcome=1`}
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
      </section>
    </div>
  )
}
