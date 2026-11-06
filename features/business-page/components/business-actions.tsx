import { useTranslations } from "next-intl"

import { NavigationIcon, PhoneCallIcon, WebsiteIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Business } from "../types"
import { directionsUrl } from "@/lib/directions-url"
import { BookButton } from "./book-button"

// Book now (when bookable), directions, call and website: only what the
// business has. A row on the phone bar, stacked in the side card. With
// booking on, Book now is the one main button and, on the phone bar,
// directions and call shrink to icons.
export function BusinessActions({
  business,
  layout,
  bookable = false,
}: {
  business: Business
  layout: "row" | "stack"
  bookable?: boolean
}) {
  const t = useTranslations("public.actions")
  const directions = directionsUrl(business)
  const wide = layout === "row" ? "flex-1" : "w-full"
  const icons = bookable && layout === "row"
  return (
    <div className={cn("flex gap-2", layout === "row" ? "w-full" : "flex-col")}>
      {bookable && (
        // On the phone bar the icons come first, Book now on the right.
        <BookButton
          slug={business.slug}
          label={t("bookNow")}
          className={cn(wide, icons && "order-last")}
        />
      )}
      {directions && (
        <Button
          variant="outline"
          size={icons ? "icon-lg" : "lg"}
          className={icons ? undefined : wide}
          aria-label={icons ? t("directions") : undefined}
          nativeButton={false}
          render={<a href={directions} target="_blank" rel="noreferrer" />}
        >
          <NavigationIcon />
          {!icons && t("directions")}
        </Button>
      )}
      {business.phone && (
        <Button
          variant={bookable ? "outline" : "default"}
          size={icons ? "icon-lg" : "lg"}
          className={icons ? undefined : wide}
          aria-label={icons ? t("call") : undefined}
          nativeButton={false}
          render={<a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} />}
        >
          <PhoneCallIcon />
          {!icons && t("call")}
        </Button>
      )}
      {layout === "stack" && business.website && (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          nativeButton={false}
          render={
            <a href={business.website} target="_blank" rel="noreferrer" />
          }
        >
          <WebsiteIcon />
          {t("website")}
        </Button>
      )}
    </div>
  )
}

export function hasActions(business: Business, bookable = false): boolean {
  return Boolean(bookable || directionsUrl(business) || business.phone)
}
