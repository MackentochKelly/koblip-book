import type { Metadata } from "next"

import { GlassCard } from "@/components/glass-frame"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { LiveCard } from "@/features/onboarding/components/live-card"
import { requireAccount } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.titles.live }
}

// The step after "Check your details": the page is live, share it. Same
// plain page and top bar as that step.
export default async function ReadyPage({
  params,
}: PageProps<"/setup/[businessId]/ready">) {
  const { businessId } = await params
  const owner = await requireAccount(`/setup/${businessId}/ready`)
  const { business } = await getOwnerBusiness(businessId)
  const page = await getBusinessPage(business.slug)
  const share = (await getOwnerMessages()).settings.share
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background",
        fontDisplay.variable
      )}
    >
      <TopBar
        business={business}
        owner={{ name: owner.name, email: owner.email, image: owner.image }}
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 pt-6 pb-24">
        <GlassCard>
          <LiveCard
            name={business.name}
            category={business.category}
            photoUrl={page?.photos[0]?.url ?? null}
            slug={business.slug}
            dashboardHref={`/dashboard/${businessId}`}
            labels={{
              live: share.live,
              linkCopied: share.linkCopied,
              shareLink: share.shareLink,
              viewMyPage: share.viewMyPage,
              toDashboard: share.toDashboard,
            }}
          />
        </GlassCard>
      </main>
      <Toaster />
    </div>
  )
}
