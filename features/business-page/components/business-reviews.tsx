"use client"

import { useState } from "react"
import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react"

import { GoogleMapsCredit } from "@/components/google-maps-credit"
import { useMessages } from "@/components/language-provider"
import { Rating } from "@/components/rating"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { PageReview } from "../types"

// How many reviews the page shows before "See more reviews".
const REVIEWS_ON_PAGE = 2

// How the reviews are chosen, with Google's logo: Google asks for both
// (developers.google.com/maps/documentation/places/web-service/policies).
function ReviewSource() {
  const m = useMessages()
  return (
    <p className="flex flex-wrap items-center text-xs text-muted-foreground">
      {m.reviews.order}
      <GoogleMapsCredit />
    </p>
  )
}

// The reviews as a list, each with who wrote it, as Google asks.
function ReviewList({
  reviews,
  columns,
  clamp,
}: {
  reviews: PageReview[]
  columns: boolean
  clamp: boolean
}) {
  return (
    <ul className={cn("grid gap-4", columns && "lg:grid-cols-2")}>
      {reviews.map((review, index) => (
        <li
          key={`${review.author.name}-${index}`}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-3">
            <Avatar>
              {review.author.photoUrl && (
                <AvatarImage
                  src={review.author.photoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback>
                {review.author.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {review.author.uri ? (
                <a
                  href={review.author.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {review.author.name}
                </a>
              ) : (
                <p className="truncate text-sm font-medium">
                  {review.author.name}
                </p>
              )}
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Rating rating={review.rating} />
                {review.when}
              </p>
            </div>
          </div>
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-line",
              clamp && "line-clamp-3"
            )}
          >
            {review.text}
          </p>
          {index < reviews.length - 1 && (
            <Separator className={cn("mt-2", columns && "lg:hidden")} />
          )}
        </li>
      ))}
    </ul>
  )
}

function GoogleReviewsLink({
  mapsUrl,
  variant,
}: {
  mapsUrl: string
  variant: "default" | "outline"
}) {
  const m = useMessages()
  return (
    <Button
      variant={variant}
      className={cn(variant === "outline" && "self-start")}
      nativeButton={false}
      render={<a href={mapsUrl} target="_blank" rel="noreferrer" />}
    >
      {m.reviews.seeAllOnGoogle}
      <ExternalLinkIcon data-icon="inline-end" />
    </Button>
  )
}

// Two Google reviews, then the rest (Google gives five at most) in a dialog
// that ends with every review on Google.
export function BusinessReviews({
  reviews,
  reviewCount,
  mapsUrl,
}: {
  reviews: PageReview[]
  reviewCount: number | null
  mapsUrl: string | null
}) {
  const m = useMessages()
  const [open, setOpen] = useState(false)
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.reviews.none}</p>
  }
  const more = reviews.length > REVIEWS_ON_PAGE
  return (
    <div className="flex flex-col gap-4">
      <ReviewSource />
      <ReviewList reviews={reviews.slice(0, REVIEWS_ON_PAGE)} columns clamp />
      {more ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {m.reviews.seeMore}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      ) : (
        mapsUrl && <GoogleReviewsLink mapsUrl={mapsUrl} variant="outline" />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.sections.reviews}</DialogTitle>
            {reviewCount !== null && (
              <DialogDescription>
                {reviewCount.toLocaleString(m.locale)}{" "}
                {m.reviews.count(reviewCount)}
              </DialogDescription>
            )}
            <ReviewSource />
          </DialogHeader>
          <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
            <ReviewList reviews={reviews} columns={false} clamp={false} />
          </div>
          {mapsUrl && (
            <DialogFooter>
              <GoogleReviewsLink mapsUrl={mapsUrl} variant="default" />
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
