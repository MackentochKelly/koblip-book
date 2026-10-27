import { Rating } from "@/components/rating"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import type { Business } from "../types"
import { BusinessStatus } from "./business-status"

// The rating and whether it is open, on one line.
export function BusinessFacts({
  business,
  open,
  language,
}: {
  business: Business
  open: boolean | null
  language: PageLanguage
}) {
  const hasStatus =
    open !== null ||
    business.status === "temporarily_closed" ||
    business.status === "closed"
  if (business.rating === null && !hasStatus) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {business.rating !== null && (
        <Rating
          rating={business.rating}
          reviewCount={business.reviewCount}
          locale={messagesFor(language).locale}
        />
      )}
      <BusinessStatus
        status={business.status}
        open={open}
        language={language}
      />
    </div>
  )
}
