import { PageSection } from "@/components/page-section"
import { Rating } from "@/components/rating"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLinkIcon } from "@/components/ui/icons"
import { Separator } from "@/components/ui/separator"
import type { ViewTab } from "@/components/view-tabs"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import type { BusinessPageData } from "../types"
import { getWeekdayInTimeZone } from "../utils/get-weekday-in-time-zone"
import { groupHours } from "../utils/group-hours"
import { BusinessAbout } from "./business-about"
import { BusinessAmenities } from "./business-amenities"
import { BusinessMap } from "./business-map"
import { BusinessPortfolio } from "./business-photos"
import { BusinessReviews } from "./business-reviews"
import { OpeningHours } from "./opening-hours"

function hasLocation({ business }: BusinessPageData): boolean {
  return Boolean(business.address || business.mapsUrl || business.latitude !== null)
}

// The section tabs for what BusinessDetails shows, in its order.
export function detailSections(
  data: BusinessPageData,
  language: PageLanguage
): ViewTab<string>[] {
  const m = messagesFor(language)
  return [
    { id: "reviews", label: m.sections.reviews },
    data.photos.length > 0 && { id: "portfolio", label: m.sections.portfolio },
    { id: "hours", label: m.sections.hours },
    data.business.description && { id: "about", label: m.sections.about },
    data.amenities.length > 0 && { id: "info", label: m.sections.info },
    hasLocation(data) && { id: "location", label: m.sections.location },
  ].filter((section) => !!section)
}

// The business's reviews, portfolio, opening times, About, extra info and
// location: the same on its page and on each team member's profile.
export function BusinessDetails({
  data,
  language,
}: {
  data: BusinessPageData
  language: PageLanguage
}) {
  const m = messagesFor(language)
  const { business, hours, photos, reviews, amenities } = data
  return (
    <>
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
          <BusinessAbout description={business.description} language={language} />
        </>
      )}
      {amenities.length > 0 && (
        <>
          <Separator />
          <PageSection id="info" title={m.sections.info}>
            <BusinessAmenities amenities={amenities} language={language} />
          </PageSection>
        </>
      )}
      {hasLocation(data) && (
        <>
          <Separator />
          <PageSection id="location" title={m.sections.location}>
            {business.latitude !== null && business.longitude !== null && (
              <BusinessMap
                name={business.name}
                latitude={business.latitude}
                longitude={business.longitude}
              />
            )}
            {business.address && <p className="text-sm">{business.address}</p>}
            {business.mapsUrl && (
              <Button
                variant="outline"
                className="self-start"
                nativeButton={false}
                render={<a href={business.mapsUrl} target="_blank" rel="noreferrer" />}
              >
                {m.page.openInMaps}
                <ExternalLinkIcon data-icon="inline-end" />
              </Button>
            )}
          </PageSection>
        </>
      )}
    </>
  )
}
