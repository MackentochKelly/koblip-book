"use client"

import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Rating } from "@/components/rating"
import { ItemGroup } from "@/components/ui/item"
import type { ReviewSummary } from "../types"
import { ReviewItem } from "./review-item"

// The section's id on the business page, for its tab.
export const CLIENT_REVIEWS_SECTION = "client-reviews"

// The business page's reviews from its own clients (D15): the average and
// how many, then the latest. Nothing until there is one.
export function ClientReviews({ summary }: { summary: ReviewSummary }) {
  const t = useTranslations("reviews")
  const locale = useLocale()
  if (summary.average === null) return null
  return (
    <PageSection
      id={CLIENT_REVIEWS_SECTION}
      title={t("page.title")}
      action={
        <Rating
          rating={summary.average}
          reviewCount={summary.count}
          locale={locale}
          className="text-sm"
        />
      }
    >
      <ItemGroup className="gap-3">
        {summary.latest.map((review) => (
          <ReviewItem key={review.id} review={review} />
        ))}
      </ItemGroup>
    </PageSection>
  )
}
