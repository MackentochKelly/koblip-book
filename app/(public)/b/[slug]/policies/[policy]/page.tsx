import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { LanguageProvider } from "@/components/language-provider"
import { getBusinessPolicy } from "@/features/business-page/api/get-business-policy"
import { PolicyDocument } from "@/features/business-page/components/policy-document"
import { pickLanguage } from "@/lib/page-language"

type Props = PageProps<"/b/[slug]/policies/[policy]">

// ?lang= wins, then the visitor's browser language, else English.
async function pageLanguage(searchParams: Props["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

// The policy (a standard kind, or the id of one of the owner's own), or a
// 404 for an unknown business or policy.
async function load({ params, searchParams }: Props) {
  const { slug, policy: segment } = await params
  const language = await pageLanguage(searchParams)
  const policy = await getBusinessPolicy(slug, segment, language)
  if (!policy) {
    notFound()
  }
  return { language, policy }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { policy } = await load(props)
  return {
    title: `${policy.title} · ${policy.business.name}`,
    // A visitor's demo copy is not a real business: kept out of search.
    ...(policy.business.isDemo && { robots: { index: false, follow: false } }),
  }
}

export default async function PolicyPage(props: Props) {
  const { language, policy } = await load(props)
  return (
    <LanguageProvider language={language}>
      <PolicyDocument policy={policy} language={language} />
    </LanguageProvider>
  )
}
