import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Rating } from "@/components/rating"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLinkIcon } from "@/components/ui/icons"
import { Separator } from "@/components/ui/separator"
import type { ViewTab } from "@/components/view-tabs"
import type { BusinessPageData } from "../types"
import { getWeekdayInTimeZone } from "../utils/get-weekday-in-time-zone"
import { groupHours, type HourRow } from "../utils/group-hours"
import { BusinessAbout } from "./business-about"
import { BusinessAmenities } from "./business-amenities"
import { BusinessMap } from "./business-map"
import { BusinessPortfolio } from "./business-photos"
import { BusinessReviews } from "./business-reviews"
import { BusinessRewards } from "./business-rewards"
import { OpeningHours } from "./opening-hours"

function hasLocation({ business }: BusinessPageData): boolean {
  return Boolean(business.address || business.mapsUrl || business.latitude !== null)
}

export type DetailSection =
  | "rewards"
  | "reviews"
  | "portfolio"
  | "hours"
  | "about"
  | "info"
  | "location"

// The section tabs for what BusinessDetails shows, in its order, each
// titled by `title` (the page's words); the hours tab takes the same title
// as its section.
export function detailSections(
  data: BusinessPageData,
  title: (section: DetailSection) => string,
  hoursTitle?: string
): ViewTab<string>[] {
  return [
    data.rewards.length > 0 && { id: "rewards", label: title("rewards") },
    { id: "reviews", label: title("reviews") },
    data.photos.length > 0 && { id: "portfolio", label: title("portfolio") },
    { id: "hours", label: hoursTitle ?? title("hours") },
    data.business.description && { id: "about", label: title("about") },
    data.amenities.length > 0 && { id: "info", label: title("info") },
    hasLocation(data) && { id: "location", label: title("location") },
  ].filter((section) => !!section)
}

// The business's reviews, portfolio, opening times, About, extra info and
// location: the same on its page and on each team member's profile, where
// `hours` are that person's own. `clientReviews`: the business's own
// clients' reviews (the reviews feature), before Google's.
export function BusinessDetails({
  data,
  hours,
  clientReviews,
}: {
  data: BusinessPageData
  hours?: { rows: HourRow[]; title: string }
  clientReviews?: React.ReactNode
}) {
  const t = useTranslations("public")
  const locale = useLocale()
  const { business, photos, reviews, amenities } = data
  return (
    <>
      {data.rewards.length > 0 && (
        <>
          <PageSection id="rewards" title={t("sections.rewards")}>
            <BusinessRewards
              rewards={data.rewards}
              currency={business.currency}
            />
          </PageSection>
          <Separator />
        </>
      )}
      {clientReviews && (
        <>
          {clientReviews}
          <Separator />
        </>
      )}
      <PageSection
        id="reviews"
        title={t("sections.reviews")}
        action={
          business.rating !== null ? (
            <Rating
              rating={business.rating}
              reviewCount={business.reviewCount}
              locale={locale}
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
            title={t("sections.portfolio")}
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
        days={groupHours(hours?.rows ?? data.hours)}
        todayWeekday={getWeekdayInTimeZone(business.timezone)}
        title={hours?.title}
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
          <PageSection id="info" title={t("sections.info")}>
            <BusinessAmenities amenities={amenities} />
          </PageSection>
        </>
      )}
      {hasLocation(data) && (
        <>
          <Separator />
          <PageSection id="location" title={t("sections.location")}>
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
                {t("page.openInMaps")}
                <ExternalLinkIcon data-icon="inline-end" />
              </Button>
            )}
          </PageSection>
        </>
      )}
    </>
  )
}
