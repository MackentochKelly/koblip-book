import Link from "next/link"
import { LanguageMenu } from "@/components/language-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

const linkClassName = cn(
  TOUCH_AREA,
  "text-sm text-muted-foreground transition-colors hover:text-foreground"
)

// The public pages' footer, kept to one quiet line: ©, Privacy and Terms,
// then language and light/dark. Wraps on narrow phones.
export function SiteFooter({ language }: { language: PageLanguage }) {
  const t = messagesFor(language).home.footer
  const links = [
    { label: t.privacy, href: `/privacy?lang=${language}` },
    { label: t.terms, href: `/terms?lang=${language}` },
  ]
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Koblip
          </p>
          <nav aria-label={t.legal}>
            <ul className="flex items-center gap-6">
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
        <div className="flex items-center gap-2">
          <LanguageMenu size="icon-sm" />
          <ThemeToggle size="icon-sm" />
        </div>
      </div>
    </footer>
  )
}
