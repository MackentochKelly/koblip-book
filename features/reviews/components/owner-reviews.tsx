"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ChevronDownIcon, StarIcon } from "@/components/ui/icons"
import { ItemGroup } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { REVIEW_HIDE_REASONS, type ReviewHideReason } from "@/lib/review-rules"
import { setReviewHidden } from "../api/actions"
import type { ListedReview } from "../types"
import { ReviewItem } from "./review-item"

// Hide one review from the page, picking why, or show it again.
function HideButton({
  businessId,
  review,
}: {
  businessId: string
  review: ListedReview
}) {
  const t = useTranslations("reviews")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const save = (reason: ReviewHideReason | null) =>
    startTransition(async () => {
      const result = await setReviewHidden(businessId, review.id, reason).catch(
        () => null
      )
      if (!result?.ok) toast.error(t("owner.failed"))
      router.refresh()
    })

  if (review.hiddenReason) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => save(null)}>
        {pending && <Spinner data-icon="inline-start" />}
        {t("owner.show")}
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" disabled={pending} />}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {t("owner.hide")}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("owner.reason")}</DropdownMenuLabel>
          {REVIEW_HIDE_REASONS.map((reason) => (
            <DropdownMenuItem key={reason} onClick={() => save(reason)}>
              {t(`reasons.${reason}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The owner's Customers → Reviews (D15): every review of the business,
// newest first, hidden ones marked with why.
export function OwnerReviews({
  businessId,
  reviews,
}: {
  businessId: string
  reviews: ListedReview[]
}) {
  const t = useTranslations("reviews")
  if (reviews.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StarIcon />
          </EmptyMedia>
          <EmptyTitle>{t("owner.none")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("owner.hideHelp")}</p>
      <ItemGroup className="gap-3">
        {reviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            about={review.serviceName}
            badge={
              review.hiddenReason && (
                <Badge variant="secondary">
                  {`${t("owner.hidden")} · ${t(`reasons.${review.hiddenReason}`)}`}
                </Badge>
              )
            }
            actions={<HideButton businessId={businessId} review={review} />}
          />
        ))}
      </ItemGroup>
    </div>
  )
}
