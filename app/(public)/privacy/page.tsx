import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { LegalPage } from "@/features/legal/components/legal-page"

// The page's language (proxy.ts): ?lang= wins, then the visitor's browser
// language, else English.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.legal.privacy")
  return { title: `${t("title")} · Koblip Book` }
}

export default function Page() {
  return <LegalPage doc="privacy" />
}
