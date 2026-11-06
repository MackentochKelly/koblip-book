import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"
import { LanguageProvider } from "@/components/language-provider"
import { WordsProvider } from "@/components/words-provider"
import { getBusinessPolicy } from "@/features/business-page/api/get-business-policy"
import { PolicyDocument } from "@/features/business-page/components/policy-document"
import { languageOf } from "@/lib/page-language"

type Props = PageProps<"/b/[slug]/policies/[policy]">

// The policy (a standard kind, or the id of one of the owner's own), or a
// 404 for an unknown business or policy. The page's language: ?lang= wins,
// then the visitor's browser language, else English (proxy.ts).
async function load({ params }: Props) {
  const { slug, policy: segment } = await params
  const language = languageOf(await getLocale())
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
    <WordsProvider namespaces={["app", "public"]}>
      <LanguageProvider language={language}>
        <PolicyDocument policy={policy} />
      </LanguageProvider>
    </WordsProvider>
  )
}
