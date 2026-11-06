import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { myBooking } from "@/features/customer-account/api/my-bookings"
import { BookingPage } from "@/features/customer-account/components/booking-page"
import { getCustomer } from "@/lib/customer-dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account.booking")
  return { title: t("title") }
}

// One of the client's own bookings (docs/plans/client-account.md, D11);
// anyone else's is not found.
export default async function AccountBookingPage({
  params,
}: PageProps<"/account/bookings/[bookingId]">) {
  const locale = await getLocale()
  const customer = await getCustomer()
  if (!customer) redirect(myBookingsLoginHref(languageOf(locale)))
  const { bookingId } = await params
  const booking = await myBooking(customer, bookingId, locale)
  if (!booking) notFound()
  return <BookingPage booking={booking} />
}
