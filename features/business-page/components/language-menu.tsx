"use client"

import { GlobeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// The globe that will switch the page between English and Spanish. Each
// language is named in itself; Spanish stays off until the page has its words.
export function LanguageMenu({ size = "icon" }: { size?: "icon" | "icon-sm" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            aria-label="Language"
            title="Language"
          />
        }
      >
        <GlobeIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value="en">
          <DropdownMenuRadioItem value="en" lang="en">
            English
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="es" lang="es" disabled>
            Español
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
