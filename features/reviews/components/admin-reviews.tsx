"use client"

import { useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { REVIEW_RULES } from "@/lib/review-rules"
import type { ListedReview } from "../types"
import { ReviewItem } from "./review-item"

// The admin's reviews (D15): the rules they follow, then every review at
// every business, hidden ones too, marked with why.
export function AdminReviews({ reviews }: { reviews: ListedReview[] }) {
  const t = useTranslations("reviews")
  const rules = [
    t("admin.maxComment", { n: REVIEW_RULES.maxComment }),
    t("admin.editDays", { n: REVIEW_RULES.editDays }),
    t("admin.ask", {
      hours: REVIEW_RULES.askAfterHours,
      days: REVIEW_RULES.askWithinDays,
    }),
    t("admin.latestShown", { n: REVIEW_RULES.latestShown }),
  ]
  return (
    <div className="flex flex-col gap-8">
      <PageSection id="rules" title={t("admin.rules")}>
        <ItemGroup className="gap-3">
          {rules.map((rule) => (
            <Item key={rule} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>{rule}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </PageSection>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.none")}</p>
      ) : (
        <ItemGroup className="gap-3">
          {reviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              about={`${review.businessName} · ${review.serviceName}`}
              badge={
                review.hiddenReason && (
                  <Badge variant="secondary">
                    {`${t("owner.hidden")} · ${t(`reasons.${review.hiddenReason}`)}`}
                  </Badge>
                )
              }
            />
          ))}
        </ItemGroup>
      )}
    </div>
  )
}
