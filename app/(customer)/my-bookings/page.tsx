import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { HeroPage } from "@/components/hero-card-page"
import { myBookings } from "@/features/customer-account/api/my-bookings"
import { MyBookingsList } from "@/features/customer-account/components/my-bookings-list"
import { SignOutButton } from "@/features/customer-account/components/sign-out-button"
import { CUSTOMER_SIGN_IN_PATH } from "@/lib/customer-auth-path"
import { getCustomer } from "@/lib/customer-dal"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"

// ?lang= wins, then the phone's language, like the business page.
async function pageLanguage(
  searchParams: PageProps<"/my-bookings">["searchParams"]
) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/my-bookings">): Promise<Metadata> {
  const m = messagesFor(await pageLanguage(searchParams))
  return { title: m.account.title, robots: { index: false } }
}

// The signed-in customer's bookings at every business.
export default async function MyBookingsPage({
  searchParams,
}: PageProps<"/my-bookings">) {
  const language = await pageLanguage(searchParams)
  const signIn = `${CUSTOMER_SIGN_IN_PATH}?lang=${language}`
  const customer = await getCustomer()
  if (!customer) redirect(signIn)
  const m = messagesFor(language)
  const { upcoming, past } = await myBookings(customer.phone, m.locale)
  return (
    <HeroPage language={language} title={m.account.hello(customer.name)} wide>
      <MyBookingsList
        upcoming={upcoming}
        past={past}
        language={language}
        m={m}
      />
      <SignOutButton next={signIn} />
    </HeroPage>
  )
}
