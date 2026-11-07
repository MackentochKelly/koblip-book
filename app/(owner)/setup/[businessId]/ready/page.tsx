import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"

import { GlassCard } from "@/components/glass-frame"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { LiveCard } from "@/features/onboarding/components/live-card"
import { PRO_CHOICE_COOKIE } from "@/features/onboarding/pro-choice"
import { requireAccount } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell.titles")
  return { title: t("live") }
}

// The step after "Check your details": the page is live, share it. Same
// plain page and top bar as that step; the card's View my page is the one
// way to the page, so the bar leaves its own out. When the owner picked Pro
// on the home page (P8), the last link goes to Settings → Plan instead.
export default async function ReadyPage({
  params,
}: PageProps<"/setup/[businessId]/ready">) {
  const { businessId } = await params
  const owner = await requireAccount(`/setup/${businessId}/ready`)
  const { business } = await getOwnerBusiness(businessId)
  const page = await getBusinessPage(business.slug)
  const share = await getTranslations("owner.settings.share")
  const pickedPro = (await cookies()).has(PRO_CHOICE_COOKIE)
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
          <LiveCard
            name={business.name}
            category={business.category}
            photoUrl={page?.photos[0]?.url ?? null}
            slug={business.slug}
            dashboardHref={
              pickedPro
                ? `/dashboard/${businessId}/settings/plan`
                : `/dashboard/${businessId}`
            }
            labels={{
              live: share("live"),
              linkCopied: share("linkCopied"),
              shareLink: share("shareLink"),
              viewMyPage: share("viewMyPage"),
              toDashboard: share(pickedPro ? "getPro" : "toDashboard"),
            }}
          />
        </GlassCard>
      </main>
      <Toaster />
    </div>
  )
}
