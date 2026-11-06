import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroPage } from "@/components/hero-card-page"
import { WordsProvider } from "@/components/words-provider"
import { myBookings } from "@/features/customer-account/api/my-bookings"
import { ClaimBooking } from "@/features/customer-account/components/claim-booking"
import { MyBookingsList } from "@/features/customer-account/components/my-bookings-list"
import { SignOutButton } from "@/features/customer-account/components/sign-out-button"
import { getCustomer } from "@/lib/customer-dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"

// The page's language is ?lang=, then the phone's, like the business page
// (proxy.ts).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account")
  return { title: t("title"), robots: { index: false } }
}

// The signed-in account's bookings at every business: the ones it made or
// claimed, and the ones made with its verified phone. Signed out, the one
// login page, coming back here.
export default async function MyBookingsPage() {
  const locale = await getLocale()
  const language = languageOf(locale)
  const logIn = myBookingsLoginHref(language)
  const customer = await getCustomer()
  if (!customer) redirect(logIn)
  const t = await getTranslations("public.account")
  const { upcoming, past } = await myBookings(customer, locale)
  return (
    <WordsProvider namespaces={["app", "public"]}>
      <HeroPage
        language={language}
        title={t("hello", { name: customer.name })}
        wide
      >
        <ClaimBooking />
        <MyBookingsList upcoming={upcoming} past={past} />
        <SignOutButton next={logIn} />
      </HeroPage>
    </WordsProvider>
  )
}
