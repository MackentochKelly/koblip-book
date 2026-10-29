import type { Metadata } from "next"
import { headers } from "next/headers"

import { LegalPage } from "@/features/legal/components/legal-page"
import { legalWordsFor } from "@/features/legal/content"
import { pickLanguage } from "@/lib/page-language"

// ?lang= wins, then the visitor's browser language, else English.
async function pageLanguage(searchParams: PageProps<"/terms">["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/terms">): Promise<Metadata> {
  const t = legalWordsFor(await pageLanguage(searchParams)).terms
  return { title: `${t.title} · Koblip Book` }
}

export default async function Page({ searchParams }: PageProps<"/terms">) {
  return <LegalPage language={await pageLanguage(searchParams)} doc="terms" />
}
