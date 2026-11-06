import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { bookAgainHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import type { MyPlace } from "../types"
import { AccountEmpty } from "./account-empty"
import { BusinessAvatar } from "./booking-facts"

// The businesses the client has booked with (D13), each with "Book again".
export function PlacesList({
  places,
  addPhone,
}: {
  places: MyPlace[]
  addPhone: boolean
}) {
  const t = useTranslations("public.account")
  const language = languageOf(useLocale())
  if (places.length === 0) {
    return <AccountEmpty title={t("places.none")} addPhone={addPhone} />
  }
  return (
    <ItemGroup className="gap-3">
      {places.map((place) => (
        <Item key={place.business.slug} variant="box">
          <ItemMedia>
            <BusinessAvatar business={place.business} />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="w-full truncate">
              {place.business.name}
            </ItemTitle>
            <ItemDescription className="truncate">
              {t("places.last", { when: place.lastWhen })}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={bookAgainHref(
                    place.business.slug,
                    place.serviceId,
                    language
                  )}
                />
              }
            >
              {t("bookAgain")}
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
