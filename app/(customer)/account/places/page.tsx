import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { myPlaces } from "@/features/customer-account/api/places"
import { PlacesList } from "@/features/customer-account/components/places-list"
import { getCustomer } from "@/lib/customer-dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import { phoneSignInReady } from "@/lib/phone-sign-in"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account.nav")
  return { title: t("places") }
}

// The businesses the client has booked with (docs/plans/client-account.md,
// D13), to book again in one tap.
export default async function AccountPlacesPage() {
  const locale = await getLocale()
  const customer = await getCustomer()
  if (!customer) redirect(myBookingsLoginHref(languageOf(locale)))
  return (
    <PlacesList
      places={await myPlaces(customer, locale)}
      addPhone={!customer.phone && phoneSignInReady()}
    />
  )
}
