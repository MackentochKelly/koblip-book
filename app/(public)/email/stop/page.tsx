import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroCardPage } from "@/components/hero-card-page"
import { Button } from "@/components/ui/button"
import { stopEmailsAction } from "@/features/email-stop/api/actions"
import { isBlocked } from "@/lib/email"
import { stopRequest } from "@/lib/email-stop"
import { languageOf } from "@/lib/page-language"

// Never in search results: a link is one person's key. The tab names the
// page, in the page's language (proxy.ts).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("emailStop")
  return { title: `${t("stop")} · Koblip Book`, robots: { index: false, follow: false } }
}

// The page a customer email's "Stop emails" link opens (EM-D10): who and
// which business, and one button. Opening it stops nothing, so a mail
// scanner that opens links can't.
export default async function EmailStopPage({ searchParams }: PageProps<"/email/stop">) {
  const { t: token } = await searchParams
  const value = typeof token === "string" ? token : ""
  const lang = languageOf(await getLocale())
  const t = await getTranslations("emailStop")
  const stop = await stopRequest(value)
  if (!stop) {
    return (
      <HeroCardPage language={lang} title={t("expired.title")}>
        <p className="text-center text-sm text-muted-foreground">{t("expired.text")}</p>
      </HeroCardPage>
    )
  }
  const names = { email: stop.email, business: stop.businessName }
  if (await isBlocked(stop.email, stop.businessId)) {
    return (
      <HeroCardPage language={lang} title={t("stopped.title")}>
        <p className="text-center text-sm text-muted-foreground">{t("stopped.text", names)}</p>
      </HeroCardPage>
    )
  }
  return (
    <HeroCardPage language={lang} title={t("title", names)}>
      <form action={stopEmailsAction} className="flex flex-col gap-4">
        <input type="hidden" name="t" value={value} />
        <p className="text-center text-sm text-muted-foreground">{t("text", names)}</p>
        <Button type="submit" size="lg">
          {t("stop")}
        </Button>
      </form>
    </HeroCardPage>
  )
}
