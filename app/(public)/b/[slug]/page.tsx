import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { BottomBar } from "@/components/bottom-bar"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { AboutPreview } from "@/features/business-page/components/about-preview"
import { BusinessAbout } from "@/features/business-page/components/business-about"
import {
  BusinessActions,
  hasActions,
} from "@/features/business-page/components/business-actions"
import {
  BusinessPhotos,
  BusinessPortfolio,
} from "@/features/business-page/components/business-photos"
import { BusinessAmenities } from "@/features/business-page/components/business-amenities"
import { ExternalLinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BusinessFooter } from "@/features/business-page/components/business-footer"
import { LanguageMenu } from "@/features/business-page/components/language-menu"
import { BusinessMap } from "@/features/business-page/components/business-map"
import { BusinessReviews } from "@/features/business-page/components/business-reviews"
import { Rating } from "@/components/rating"
import { SectionTabs } from "@/features/business-page/components/section-tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageSection } from "@/components/page-section"
import { BusinessSideCard } from "@/features/business-page/components/business-side-card"
import { BusinessSummary } from "@/features/business-page/components/business-summary"
import { OpeningHours } from "@/features/business-page/components/opening-hours"
import { ServiceList } from "@/features/business-page/components/service-list"
import { ShareButton } from "@/features/business-page/components/share-button"
import { TeamList } from "@/features/business-page/components/team-list"
import { getWeekdayInTimeZone } from "@/features/business-page/utils/get-weekday-in-time-zone"
import { groupHours } from "@/features/business-page/utils/group-hours"
import { isOpenNow } from "@/features/business-page/utils/is-open-now"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getBusinessPage(slug)
  if (!data) {
    notFound()
  }
  return {
    title: data.business.name,
    description: data.business.description ?? undefined,
  }
}

export default async function BusinessPage({ params }: Props) {
  const { slug } = await params
  const data = await getBusinessPage(slug)
  if (!data) {
    notFound()
  }
  const { business, hours, services, team, photos, reviews, amenities } = data
  // No hours saved: say nothing rather than "Closed now".
  const open = hours.length > 0 ? isOpenNow(hours, business.timezone) : null
  const hasLocation = Boolean(
    business.address || business.mapsUrl || business.latitude !== null
  )
  const sections = [
    services.length > 0 && { id: "services", label: "Services" },
    team.length > 0 && { id: "team", label: "Team" },
    { id: "reviews", label: "Reviews" },
    photos.length > 0 && { id: "portfolio", label: "Portfolio" },
    { id: "hours", label: "Opening times" },
    business.description && { id: "about", label: "About" },
    amenities.length > 0 && { id: "info", label: "Additional information" },
    hasLocation && { id: "location", label: "Location" },
  ].filter((section) => !!section)

  return (
    <>
      <main className="mx-auto w-full max-w-6xl pb-28 md:px-6 md:pt-6 md:pb-16">
        <BusinessPhotos photos={photos} />
        <div className="grid gap-8 px-4 pt-5 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-10 md:px-0 md:pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="flex items-start justify-between gap-3">
              <BusinessSummary business={business} open={open} />
              <div className="flex shrink-0 gap-2 md:hidden">
                <ThemeToggle />
                <LanguageMenu />
                <ShareButton title={business.name} />
              </div>
            </div>
            {business.description && (
              <AboutPreview text={business.description} />
            )}
            <SectionTabs sections={sections} />
            {services.length > 0 && (
              <>
                <ServiceList services={services} currency={business.currency} />
                <Separator />
              </>
            )}
            {team.length > 0 && (
              <>
                <TeamList team={team} />
                <Separator />
              </>
            )}
            <PageSection
              id="reviews"
              title="Reviews"
              action={
                business.rating !== null ? (
                  <Rating
                    rating={business.rating}
                    reviewCount={business.reviewCount}
                    className="text-sm"
                  />
                ) : undefined
              }
            >
              <BusinessReviews
                reviews={reviews}
                reviewCount={business.reviewCount}
                mapsUrl={business.mapsUrl}
              />
            </PageSection>
            <Separator />
            {photos.length > 0 && (
              <>
                <PageSection
                  id="portfolio"
                  title="Portfolio"
                  action={
                    <Badge variant="outline" className="mr-auto">
                      {photos.length}
                    </Badge>
                  }
                >
                  <BusinessPortfolio photos={photos} />
                </PageSection>
                <Separator />
              </>
            )}
            <OpeningHours
              days={groupHours(hours)}
              todayWeekday={getWeekdayInTimeZone(business.timezone)}
            />
            {business.description && (
              <>
                <Separator />
                <BusinessAbout description={business.description} />
              </>
            )}
            {amenities.length > 0 && (
              <>
                <Separator />
                <PageSection id="info" title="Additional information">
                  <BusinessAmenities amenities={amenities} />
                </PageSection>
              </>
            )}
            {hasLocation && (
              <>
                <Separator />
                <PageSection id="location" title="Location">
                  {business.latitude !== null &&
                    business.longitude !== null && (
                      <BusinessMap
                        name={business.name}
                        latitude={business.latitude}
                        longitude={business.longitude}
                      />
                    )}
                  {business.address && (
                    <p className="text-sm">{business.address}</p>
                  )}
                  {business.mapsUrl && (
                    <Button
                      variant="outline"
                      className="self-start"
                      nativeButton={false}
                      render={
                        <a
                          href={business.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      Open in Google Maps
                      <ExternalLinkIcon data-icon="inline-end" />
                    </Button>
                  )}
                </PageSection>
              </>
            )}
            <BusinessFooter
              name={business.name}
              fromGoogle={business.googlePlaceId !== null}
            />
          </div>
          <aside className="hidden md:block">
            <BusinessSideCard business={business} open={open} />
          </aside>
        </div>
      </main>
      {hasActions(business) && (
        <BottomBar label="Contact" className="md:hidden">
          <BusinessActions business={business} layout="row" />
        </BottomBar>
      )}
      <Toaster />
    </>
  )
}
