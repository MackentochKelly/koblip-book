import Link from "next/link"

import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { LanguageMenu } from "@/components/language-menu"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { BadgeCheckIcon } from "@/components/ui/icons"
import { Separator } from "@/components/ui/separator"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

const linkClassName = cn(
  TOUCH_AREA,
  "text-sm text-muted-foreground transition-colors hover:text-foreground"
)

// The home page's footer: who we are, links to the page's sections and log
// in, then ©, language and light/dark. Only real links (no Privacy or Terms
// pages yet). Columns stack on phones.
export function SiteFooter({
  language,
  signedIn,
}: {
  language: PageLanguage
  signedIn: boolean
}) {
  const t = messagesFor(language).home
  const columns = [
    {
      title: t.footer.product,
      links: [
        { label: t.steps.title, href: `#${HOME_SECTION_IDS.howItWorks}` },
        { label: t.features.title, href: `#${HOME_SECTION_IDS.features}` },
        { label: t.faq.title, href: `#${HOME_SECTION_IDS.faq}` },
      ],
    },
    {
      title: t.footer.account,
      links: [
        signedIn
          ? { label: t.dashboard, href: "/dashboard" }
          : { label: t.logIn, href: "/login" },
      ],
    },
  ]
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
      <Separator />
      <div className="grid grid-cols-2 gap-8 py-10 sm:grid-cols-[1fr_auto_auto] sm:gap-16">
        <div className="col-span-2 flex flex-col items-start gap-3 sm:col-span-1">
          <Logo className="text-foreground" />
          <p className="text-sm text-muted-foreground">{t.description}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BadgeCheckIcon className="size-4 text-verified" />
            {t.provider.badge}
          </p>
        </div>
        {columns.map((column) => (
          <nav
            key={column.title}
            aria-label={column.title}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-medium">{column.title}</p>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-4 pt-6">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Koblip
        </p>
        <div className="flex items-center gap-2">
          <LanguageMenu size="icon-sm" />
          <ThemeToggle size="icon-sm" />
        </div>
      </div>
    </footer>
  )
}
