"use client"

import { useLocale } from "next-intl"

import { Rating } from "@/components/rating"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import type { PublicReview } from "../types"

// One review, the same on the business page, in the owner's list and in the
// admin: the client's first name, stars and month, then the comment.
// `about`: one more line (the service, the business); `actions` at the end.
export function ReviewItem({
  review,
  about,
  badge,
  actions,
}: {
  review: PublicReview
  about?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}) {
  const locale = useLocale()
  const when = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(review.at))
  return (
    <Item variant="outline" className="items-start">
      <ItemMedia>
        <Avatar>
          <AvatarFallback>
            {review.authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className="truncate">{review.authorName}</span>
          {badge}
        </ItemTitle>
        <ItemDescription className="flex items-center gap-2">
          <Rating rating={review.stars} />
          {when}
        </ItemDescription>
        {about && (
          <ItemDescription className="truncate">{about}</ItemDescription>
        )}
        {review.comment && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-line">
            {review.comment}
          </p>
        )}
      </ItemContent>
      {actions && <ItemActions>{actions}</ItemActions>}
    </Item>
  )
}
