"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { GlobeIcon } from "@/components/ui/icons"

import { useMessages, usePageLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isPageLanguage } from "@/lib/page-language"

// The globe that switches the page between English and Spanish. Each
// language is named in itself; the choice is kept in the address (?lang=).
export function LanguageMenu({
  size = "icon",
  className,
}: {
  size?: "icon" | "icon-sm"
  className?: string
}) {
  const m = useMessages()
  const language = usePageLanguage()
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
            size={size}
            className={className}
            aria-label={m.page.language}
            title={m.page.language}
          />
        }
      >
        <GlobeIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={language} onValueChange={change}>
          {/* Picking a language closes the menu (Base UI keeps a radio
              menu open by default). */}
          <DropdownMenuRadioItem value="en" lang="en" closeOnClick>
            English
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="es" lang="es" closeOnClick>
            Español
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
