import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { LanguageProvider } from "@/components/language-provider"
import { WordsProvider } from "@/components/words-provider"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { BookingFlow } from "@/features/booking/components/booking-flow"
import { toBookingPage } from "@/features/booking/components/booking-page"
import { paymentOptionsFor } from "@/lib/payment-methods"
import { isBookable } from "@/features/booking/utils/is-bookable"
import { languageOf } from "@/lib/page-language"
import { offersWhatsapp } from "@/lib/whatsapp-offer"

type Props = PageProps<"/b/[slug]/book">

// The page's language: ?lang= wins, then the visitor's browser language,
// else English (proxy.ts).
async function pageLanguage() {
  return languageOf(await getLocale())
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const language = await pageLanguage()
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  const t = await getTranslations("public.actions")
  return {
    title: `${t("book")} · ${data.business.name}`,
    robots: { index: false },
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const language = await pageLanguage()
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  const [whatsapp, payments] = await Promise.all([
    offersWhatsapp(data.business.id),
    paymentOptionsFor(data.business.id),
  ])
  const bookable = isBookable({
    status: data.business.status,
    servicesCount: data.services.length,
    hoursCount: data.hours.length,
  })
  if (!bookable) {
    redirect(`/b/${slug}`)
  }
  return (
    <WordsProvider namespaces={["app", "public"]}>
      <LanguageProvider language={language}>
        <div lang={language}>
          <BookingFlow page={toBookingPage({ ...data, whatsapp, payments })} mode="page" />
        </div>
        <Toaster />
      </LanguageProvider>
    </WordsProvider>
  )
}
