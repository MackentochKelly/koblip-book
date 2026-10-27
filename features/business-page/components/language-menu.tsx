"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { GlobeIcon } from "lucide-react"

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
export function LanguageMenu({ size = "icon" }: { size?: "icon" | "icon-sm" }) {
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
            aria-label={m.page.language}
            title={m.page.language}
          />
        }
      >
        <GlobeIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={language} onValueChange={change}>
          <DropdownMenuRadioItem value="en" lang="en">
            English
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="es" lang="es">
            Español
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
