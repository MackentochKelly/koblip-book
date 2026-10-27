import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { LanguageProvider } from "@/components/language-provider"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"
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
import { ClaimCard } from "@/features/business-page/components/claim-card"
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
import { BookingFlow } from "@/features/booking/components/booking-flow"
import { toBookingPage } from "@/features/booking/components/booking-page"
import { isBookable } from "@/features/booking/utils/is-bookable"

type Props = PageProps<"/b/[slug]">

// ?lang= wins, then the visitor's browser language, else English.
async function pageLanguage(searchParams: Props["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params
  const language = await pageLanguage(searchParams)
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  return {
    title: data.business.name,
    description: data.business.description ?? undefined,
  }
}

export default async function BusinessPage({ params, searchParams }: Props) {
  const { slug } = await params
  const language = await pageLanguage(searchParams)
  const m = messagesFor(language)
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  const { business, hours, services, team, photos, reviews, amenities } = data
  // No hours saved: say nothing rather than "Closed now".
  const open = hours.length > 0 ? isOpenNow(hours, business.timezone) : null
  const bookable = isBookable({
    status: business.status,
    servicesCount: services.length,
    hoursCount: hours.length,
  })
  const hasLocation = Boolean(
    business.address || business.mapsUrl || business.latitude !== null
  )
  const sections = [
    services.length > 0 && { id: "services", label: m.sections.services },
    team.length > 0 && { id: "team", label: m.sections.team },
    { id: "reviews", label: m.sections.reviews },
    photos.length > 0 && { id: "portfolio", label: m.sections.portfolio },
    { id: "hours", label: m.sections.hours },
    business.description && { id: "about", label: m.sections.about },
    amenities.length > 0 && { id: "info", label: m.sections.info },
    hasLocation && { id: "location", label: m.sections.location },
  ].filter((section) => !!section)

  return (
    <LanguageProvider language={language}>
      <main
        lang={language}
        className="mx-auto w-full max-w-6xl pb-28 md:px-6 md:pt-6 md:pb-16"
      >
        <BusinessPhotos photos={photos} />
        <div className="grid gap-8 px-4 pt-5 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-10 md:px-0 md:pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="flex items-start justify-between gap-3">
              <BusinessSummary
                business={business}
                open={open}
                language={language}
              />
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
            <ServiceList
              services={services}
              currency={business.currency}
              slug={business.slug}
              bookable={bookable}
            />
            {team.length > 0 && (
              <>
                <TeamList team={team} language={language} />
                <Separator />
              </>
            )}
            <PageSection
              id="reviews"
              title={m.sections.reviews}
              action={
                business.rating !== null ? (
                  <Rating
                    rating={business.rating}
                    reviewCount={business.reviewCount}
                    locale={m.locale}
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
                  title={m.sections.portfolio}
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
              language={language}
            />
            {business.description && (
              <>
                <Separator />
                <BusinessAbout
                  description={business.description}
                  language={language}
                />
              </>
            )}
            {amenities.length > 0 && (
              <>
                <Separator />
                <PageSection id="info" title={m.sections.info}>
                  <BusinessAmenities
                    amenities={amenities}
                    language={language}
                  />
                </PageSection>
              </>
            )}
            {hasLocation && (
              <>
                <Separator />
                <PageSection id="location" title={m.sections.location}>
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
                      {m.page.openInMaps}
                      <ExternalLinkIcon data-icon="inline-end" />
                    </Button>
                  )}
                </PageSection>
              </>
            )}
            {business.ownerId === null && (
              <ClaimCard slug={business.slug} language={language} />
            )}
            <BusinessFooter
              name={business.name}
              fromGoogle={business.googlePlaceId !== null}
              language={language}
            />
          </div>
          <aside className="hidden md:block">
            <BusinessSideCard
              business={business}
              open={open}
              bookable={bookable}
              language={language}
            />
          </aside>
        </div>
      </main>
      {hasActions(business, bookable) && (
        <BottomBar label={m.page.contact} className="md:hidden">
          <BusinessActions
            business={business}
            layout="row"
            bookable={bookable}
            language={language}
          />
        </BottomBar>
      )}
      {bookable && <BookingFlow page={toBookingPage(data)} mode="drawer" />}
      <Toaster />
    </LanguageProvider>
  )
}
