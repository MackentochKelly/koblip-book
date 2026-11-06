import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroCardPage, HeroPage } from "@/components/hero-card-page"
import { WordsProvider } from "@/components/words-provider"
import { myBookings } from "@/features/customer-account/api/my-bookings"
import { AddPhoneForm } from "@/features/customer-account/components/add-phone-form"
import { MyBookingsList } from "@/features/customer-account/components/my-bookings-list"
import { SignOutButton } from "@/features/customer-account/components/sign-out-button"
import { getSession } from "@/lib/dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import { phoneSignInReady } from "@/lib/phone-sign-in"

// The page's language is ?lang=, then the phone's, like the business page
// (proxy.ts).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account")
  return { title: t("title"), robots: { index: false } }
}

// The signed-in account's bookings at every business: the ones made with
// its phone. Signed out, the one login page; no phone yet, add it first.
// Phones are proved by a code, so the page waits for codes to be sendable.
export default async function MyBookingsPage() {
  if (!phoneSignInReady()) notFound()
  const locale = await getLocale()
  const language = languageOf(locale)
  const logIn = myBookingsLoginHref(language)
  const session = await getSession()
  if (!session || session.isGuest) redirect(logIn)
  const t = await getTranslations("public.account")
  if (!session.phone) {
    return (
      <WordsProvider namespaces={["app", "public"]}>
        <HeroCardPage language={language} title={t("addPhone")}>
          <AddPhoneForm />
          <SignOutButton next={logIn} />
        </HeroCardPage>
      </WordsProvider>
    )
  }
  const { upcoming, past } = await myBookings(session.phone, locale)
  return (
    <WordsProvider namespaces={["app", "public"]}>
      <HeroPage language={language} title={t("hello", { name: session.name })} wide>
        <MyBookingsList upcoming={upcoming} past={past} />
        <SignOutButton next={logIn} />
      </HeroPage>
    </WordsProvider>
  )
}
