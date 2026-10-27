import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { LanguageProvider } from "@/components/language-provider"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { BookingFlow } from "@/features/booking/components/booking-flow"
import { toBookingPage } from "@/features/booking/components/booking-page"
import { isBookable } from "@/features/booking/utils/is-bookable"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"

type Props = PageProps<"/b/[slug]/book">

// ?lang= wins, then the visitor's browser language, else English.
async function pageLanguage(searchParams: Props["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params
  const language = await pageLanguage(searchParams)
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  return {
    title: `${messagesFor(language).actions.book} · ${data.business.name}`,
    robots: { index: false },
  }
}

export default async function BookPage({ params, searchParams }: Props) {
  const { slug } = await params
  const language = await pageLanguage(searchParams)
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  const bookable = isBookable({
    status: data.business.status,
    servicesCount: data.services.length,
    hoursCount: data.hours.length,
  })
  if (!bookable) {
    redirect(`/b/${slug}`)
  }
  return (
    <LanguageProvider language={language}>
      <div lang={language}>
        <BookingFlow page={toBookingPage(data)} mode="page" />
      </div>
      <Toaster />
    </LanguageProvider>
  )
}
