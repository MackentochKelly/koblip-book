import type { Metadata } from "next"
import { after } from "next/server"
import { getTranslations } from "next-intl/server"

import { GlassCard } from "@/components/glass-frame"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TopBar } from "@/features/dashboard/components/top-bar"
import { GoogleDetailsCard } from "@/features/onboarding/components/google-details-card"
import { startPreparing } from "@/features/starter-catalog/api/prepare-jobs"
import { requireAccount } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { thumbnailUrl } from "@/lib/place-photo"
import { translateBusinessNow } from "@/lib/translations/business-texts"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.found")
  return { title: t("title") }
}

// Right after sign-up: the page's Google Maps details appear one at a time,
// then "Check your details" opens. Same plain page and top bar as the steps
// after it.
export default async function GoogleDetailsPage({
  params,
}: PageProps<"/setup/[businessId]/google">) {
  const { businessId } = await params
  const owner = await requireAccount(`/setup/${businessId}/google`)
  const { business } = await getOwnerBusiness(businessId)
  const page = await getBusinessPage(business.slug)
  // Muse starts the page's services, policies and team photos, then
  // Google translates its texts, now, while the owner reads this screen
  // and checks the details, so they are nearly ready by "Getting your
  // page ready".
  after(() =>
    startPreparing(business, () => translateBusinessNow(business.id))
  )
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
          <GoogleDetailsCard
            nextHref={`/setup/${businessId}`}
            details={{
              name: business.name,
              category: business.category,
              address: business.address,
              phone: business.phone,
              openDays: new Set(page?.hours.map((hour) => hour.weekday)).size,
              photoUrls: (page?.photos ?? [])
                .slice(0, 3)
                .map((photo) => thumbnailUrl(photo.url)),
              photoCount: page?.photos.length ?? 0,
              rating: page?.business.rating ?? null,
              reviewCount: page?.business.reviewCount ?? null,
              about: business.description,
            }}
          />
        </GlassCard>
      </main>
    </div>
  )
}
