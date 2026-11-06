"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { GlobeIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  isPageLanguage,
  LANGUAGE_NAMES,
  languageOf,
  PAGE_LANGUAGES,
} from "@/lib/page-language"

// The globe that switches the page between the app's languages. Each
// language is named in itself; the choice is kept in the address (?lang=).
export function LanguageMenu({ className }: { className?: string }) {
  const t = useTranslations("app.languageMenu")
  const language = languageOf(useLocale())
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const change = (next: unknown) => {
    if (!isPageLanguage(next) || next === language) return
    const query = new URLSearchParams(params)
    query.set("lang", next)
    router.replace(`${pathname}?${query}`, { scroll: false })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={className}
            aria-label={t("label")}
            title={t("label")}
          />
        }
      >
        <GlobeIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={language} onValueChange={change}>
          {/* Picking a language closes the menu (Base UI keeps a radio
              menu open by default). */}
          {PAGE_LANGUAGES.map((code) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              lang={code}
              closeOnClick
            >
              {LANGUAGE_NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
