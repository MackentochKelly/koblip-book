import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { LanguageProvider } from "@/components/language-provider"
import { getBusinessPolicy } from "@/features/business-page/api/get-business-policy"
import { PolicyDocument } from "@/features/business-page/components/policy-document"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"
import { isPolicyKind } from "@/lib/policy-rules"

type Props = PageProps<"/b/[slug]/policies/[kind]">

// ?lang= wins, then the visitor's browser language, else English.
async function pageLanguage(searchParams: Props["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

// The policy, or a 404 for an unknown kind, business or empty policy.
async function load({ params, searchParams }: Props) {
  const { slug, kind } = await params
  if (!isPolicyKind(kind)) {
    notFound()
  }
  const language = await pageLanguage(searchParams)
  const policy = await getBusinessPolicy(slug, kind, language)
  if (!policy) {
    notFound()
  }
  return { kind, language, policy }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { kind, language, policy } = await load(props)
  return {
    title: `${messagesFor(language).policies[kind]} · ${policy.business.name}`,
    // A visitor's demo copy is not a real business: kept out of search.
    ...(policy.business.isDemo && { robots: { index: false, follow: false } }),
  }
}

export default async function PolicyPage(props: Props) {
  const { kind, language, policy } = await load(props)
  return (
    <LanguageProvider language={language}>
      <PolicyDocument kind={kind} policy={policy} language={language} />
    </LanguageProvider>
  )
}
