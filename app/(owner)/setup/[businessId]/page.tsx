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
// login page's look: one rounded panel on the moving gradient.
export default async function SetupPage({
  params,
}: PageProps<"/setup/[businessId]">) {
  const { businessId } = await params
  await requireOwner(`/setup/${businessId}`)
  const { business, team } = await getOwnerBusiness(businessId)
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
        fontDisplay.variable
      )}
    >
      <section className="relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl">
        <HeroGradient />
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 pt-6 pb-24">
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
