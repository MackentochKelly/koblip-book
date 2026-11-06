import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { myBookings } from "@/features/customer-account/api/my-bookings"
import { ClaimBooking } from "@/features/customer-account/components/claim-booking"
import { MyBookingsList } from "@/features/customer-account/components/my-bookings-list"
import { getCustomer } from "@/lib/customer-dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account.nav")
  return { title: t("bookings") }
}

// The client's bookings at every business: the ones the account made or
// claimed, and the ones made with its verified phone. A booking made
// signed out just before ("Manage your booking") joins it here.
export default async function AccountBookingsPage() {
  const locale = await getLocale()
  const customer = await getCustomer()
  if (!customer) redirect(myBookingsLoginHref(languageOf(locale)))
  const { upcoming, past } = await myBookings(customer, locale)
  return (
    <>
      <ClaimBooking />
      <MyBookingsList upcoming={upcoming} past={past} />
    </>
  )
}
