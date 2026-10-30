import Link from "next/link"
import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { LanguageMenu } from "@/components/language-menu"
import { KoblipMark, Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { ArrowUpIcon } from "@/components/ui/icons"
import { Separator } from "@/components/ui/separator"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

const linkClassName = cn(
  TOUCH_AREA,
  "text-sm text-muted-foreground transition-colors hover:text-foreground"
)

// The public pages' footer, like the big apps' (Beam's): the logo and its
// line beside two short columns of links; then ©, language and light/dark,
// and back to top; then the name drawn huge and faint, fading out at the
// bottom. Stacks on phones.
export function SiteFooter({ language }: { language: PageLanguage }) {
  const home = messagesFor(language).home
  const t = home.footer
  // The page's sections in the first column, the legal pages in the second.
  const links = [
    { label: home.steps.title, href: `/#${HOME_SECTION_IDS.howItWorks}` },
    { label: home.features.title, href: `/#${HOME_SECTION_IDS.features}` },
    { label: home.action.title, href: `/#${HOME_SECTION_IDS.action}` },
    { label: home.faq.title, href: `/#${HOME_SECTION_IDS.faq}` },
    { label: t.privacy, href: `/privacy?lang=${language}` },
    { label: t.terms, href: `/terms?lang=${language}` },
  ]
  return (
    <footer className="mx-auto w-full max-w-page px-4 sm:px-6">
      <Separator />
      <div className="flex flex-col gap-10 py-12 md:flex-row md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo className="text-3xl text-foreground" />
          <p className="text-muted-foreground">{home.description}</p>
        </div>
        <nav aria-label={t.pages}>
          <ul className="grid grid-flow-col grid-rows-4 gap-x-16 gap-y-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Koblip
        </p>
        <div className="flex items-center gap-2">
          <LanguageMenu size="icon-sm" />
          <ThemeToggle size="icon-sm" />
        </div>
        <a href="#" className={cn(linkClassName, "flex items-center gap-1")}>
          {t.backToTop}
          <ArrowUpIcon className="size-4" />
        </a>
      </div>
      {/* The name, huge and faint, fading out towards the bottom. Faded as
          a whole (opacity), not by a see-through colour, so the drawing's
          overlapping edges don't show darker. */}
      <div
        aria-hidden
        className="mt-12 mask-b-from-20% mask-b-to-90% text-foreground opacity-15"
      >
        <KoblipMark className="h-auto w-full" />
      </div>
    </footer>
  )
}
