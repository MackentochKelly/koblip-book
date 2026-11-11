import { useLocale } from "next-intl"

import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Business } from "../types"
import { BusinessActions } from "./business-actions"
import { Rating } from "@/components/rating"
import { LanguageMenu } from "@/components/language-menu"
import { ShareButton } from "./share-button"

// On a computer: the business and its buttons, kept in view beside the page.
// Whether it is open now shows once, in the page's own header.
export function BusinessSideCard({
  business,
  bookable,
}: {
  business: Business
  bookable: boolean
}) {
  const locale = useLocale()
  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-lg">{business.name}</CardTitle>
        {business.category && (
          <CardDescription>{business.category}</CardDescription>
        )}
        <CardAction className="flex gap-2">
          <ThemeToggle />
          <LanguageMenu />
          <ShareButton title={business.name} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {business.rating !== null && (
          <Rating
            rating={business.rating}
            reviewCount={business.reviewCount}
            locale={locale}
          />
        )}
        {business.address && (
          <p className="text-sm text-muted-foreground">{business.address}</p>
        )}
        <BusinessActions
          business={business}
          layout="stack"
          bookable={bookable}
        />
      </CardContent>
    </Card>
  )
}
