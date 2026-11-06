import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"
import { LanguageProvider } from "@/components/language-provider"
import { WordsProvider } from "@/components/words-provider"
import { Toaster } from "@/components/ui/sonner"
import { getTeamProfile } from "@/features/business-page/api/get-team-profile"
import { TeamProfile } from "@/features/business-page/components/team-profile"
import { isBookable } from "@/features/booking/utils/is-bookable"
import { languageOf } from "@/lib/page-language"

type Props = PageProps<"/b/[slug]/team/[memberId]">

// The profile, or a 404 for an unknown business or team member. The page's
// language: ?lang= wins, then the visitor's browser language, else English
// (proxy.ts).
async function load({ params }: Props) {
  const { slug, memberId } = await params
  const language = languageOf(await getLocale())
  const profile = await getTeamProfile(slug, memberId, language)
  if (!profile) {
    notFound()
  }
  return { language, profile }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { profile } = await load(props)
  const { business } = profile.data
  return {
    title: `${profile.member.name} · ${business.name}`,
    description: profile.member.description ?? undefined,
    // A visitor's demo copy is not a real business: kept out of search.
    ...(business.isDemo && { robots: { index: false, follow: false } }),
  }
}

export default async function TeamProfilePage(props: Props) {
  const { language, profile } = await load(props)
  const { data } = profile
  const bookable = isBookable({
    status: data.business.status,
    servicesCount: data.services.length,
    hoursCount: data.hours.length,
  })
  return (
    <WordsProvider namespaces={["app", "public"]}>
      <LanguageProvider language={language}>
        <TeamProfile profile={profile} bookable={bookable} />
        <Toaster />
      </LanguageProvider>
    </WordsProvider>
  )
}
