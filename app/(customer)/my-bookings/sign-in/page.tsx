import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { HeroCardPage } from "@/components/hero-card-page"
import { SignInForm } from "@/features/customer-account/components/sign-in-form"
import { MY_BOOKINGS_PATH } from "@/lib/customer-auth-path"
import { getCustomer } from "@/lib/customer-dal"
import { customerSignInReady } from "@/lib/customer-sign-in"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"

async function pageLanguage(
  searchParams: PageProps<"/my-bookings/sign-in">["searchParams"]
) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/my-bookings/sign-in">): Promise<Metadata> {
  const m = messagesFor(await pageLanguage(searchParams))
  return { title: m.account.signInTitle, robots: { index: false } }
}

// A customer signs in with the phone they booked with and a code.
export default async function CustomerSignInPage({
  searchParams,
}: PageProps<"/my-bookings/sign-in">) {
  if (!customerSignInReady()) notFound()
  const language = await pageLanguage(searchParams)
  const next = `${MY_BOOKINGS_PATH}?lang=${language}`
  if (await getCustomer()) redirect(next)
  const m = messagesFor(language)
  return (
    <HeroCardPage language={language} title={m.account.signInTitle}>
      <SignInForm next={next} />
    </HeroCardPage>
  )
}
