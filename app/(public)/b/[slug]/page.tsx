import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { LanguageProvider } from "@/components/language-provider"
import { getSession } from "@/lib/dal"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"
import { phoneSignInReady } from "@/lib/phone-sign-in"
import { offersWhatsapp } from "@/lib/whatsapp-offer"
import { ThemeToggle } from "@/components/theme-toggle"
import { BottomBar } from "@/components/bottom-bar"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { AboutPreview } from "@/features/business-page/components/about-preview"
import {
  BusinessActions,
  hasActions,
} from "@/features/business-page/components/business-actions"
import {
  BusinessDetails,
  detailSections,
} from "@/features/business-page/components/business-details"
import { BusinessPhotos } from "@/features/business-page/components/business-photos"
import { BusinessFooter } from "@/features/business-page/components/business-footer"
import { LanguageMenu } from "@/components/language-menu"
import { SectionTabs } from "@/features/business-page/components/section-tabs"
import { Separator } from "@/components/ui/separator"
import { BusinessSideCard } from "@/features/business-page/components/business-side-card"
import { BusinessSummary } from "@/features/business-page/components/business-summary"
import { ServiceList } from "@/features/business-page/components/service-list"
import { OwnerBackButton } from "@/features/business-page/components/owner-back-button"
import { ShareButton } from "@/features/business-page/components/share-button"
import { TeamList } from "@/features/business-page/components/team-list"
import { isOpenNow } from "@/features/business-page/utils/is-open-now"
import { BookingFlow } from "@/features/booking/components/booking-flow"
import { toBookingPage } from "@/features/booking/components/booking-page"
import { isBookable } from "@/features/booking/utils/is-bookable"

type Props = PageProps<"/b/[slug]">

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
    title: data.business.name,
    description: data.business.description ?? undefined,
    // A visitor's demo copy is not a real business: kept out of search.
    ...(data.business.isDemo && { robots: { index: false, follow: false } }),
  }
}

export default async function BusinessPage({ params, searchParams }: Props) {
  const { slug } = await params
  const language = await pageLanguage(searchParams)
  const m = messagesFor(language)
  const data = await getBusinessPage(slug, language)
  if (!data) {
    notFound()
  }
  const { business, hours, services, team, photos } = data
  // No hours saved: say nothing rather than "Closed now".
  const open = hours.length > 0 ? isOpenNow(hours, business.timezone) : null
  const whatsapp = await offersWhatsapp(data.business.id)
  const isOwner = (await getSession())?.userId === business.ownerId
  const bookable = isBookable({
    status: business.status,
    servicesCount: services.length,
    hoursCount: hours.length,
  })
  const sections = [
    ...(services.length > 0 ? [{ id: "services", label: m.sections.services }] : []),
    ...(team.length > 0 ? [{ id: "team", label: m.sections.team }] : []),
    ...detailSections(data, language),
  ]

  return (
    <LanguageProvider language={language}>
      <main
        lang={language}
        className="mx-auto w-full max-w-page pb-28 md:px-6 md:pt-6 md:pb-16"
      >
        <BusinessPhotos photos={photos} />
        <div className="grid gap-8 px-4 pt-5 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-10 md:px-0 md:pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="flex items-start justify-between gap-3">
              <BusinessSummary
                business={business}
                open={open}
                language={language}
              />
              <div className="flex shrink-0 gap-2 md:hidden">
                <ThemeToggle />
                <LanguageMenu />
                <ShareButton title={business.name} />
              </div>
            </div>
            {business.description && (
              <AboutPreview text={business.description} />
            )}
            <SectionTabs sections={sections} />
            <ServiceList
              services={services}
              serviceCategories={data.serviceCategories}
              currency={business.currency}
              slug={business.slug}
              bookable={bookable}
            />
            {team.length > 0 && (
              <>
                <TeamList slug={business.slug} team={team} language={language} />
                <Separator />
              </>
            )}
            <BusinessDetails data={data} language={language} />
            <BusinessFooter
              name={business.name}
              slug={business.slug}
              policies={data.policies}
              fromGoogle={business.googlePlaceId !== null}
              language={language}
            />
          </div>
          <aside className="hidden md:block">
            <BusinessSideCard
              business={business}
              open={open}
              bookable={bookable}
              language={language}
            />
          </aside>
        </div>
      </main>
      {hasActions(business, bookable) && (
        <BottomBar label={m.page.contact} className="md:hidden">
          <BusinessActions
            business={business}
            layout="row"
            bookable={bookable}
            language={language}
          />
        </BottomBar>
      )}
      {bookable && <BookingFlow page={toBookingPage({ ...data, whatsapp, manageBookings: phoneSignInReady() })} mode="drawer" />}
      {isOwner && <OwnerBackButton businessId={business.id} />}
      <Toaster />
    </LanguageProvider>
  )
}
