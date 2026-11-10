import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { myRewards } from "@/features/customer-account/api/my-rewards"
import { RewardsList } from "@/features/customer-account/components/rewards-list"
import { getCustomer } from "@/lib/customer-dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import { phoneSignInReady } from "@/lib/phone-sign-in"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account.nav")
  return { title: t("rewards") }
}

// The client's rewards at each business they book with
// (docs/plans/rewards.md, RW-7).
export default async function AccountRewardsPage() {
  const locale = await getLocale()
  const customer = await getCustomer()
  if (!customer) redirect(myBookingsLoginHref(languageOf(locale)))
  return (
    <RewardsList
      places={await myRewards(customer, locale)}
      addPhone={!customer.phone && phoneSignInReady()}
    />
  )
}
