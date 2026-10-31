"use client"

import { useState } from "react"

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon } from "@/components/ui/icons"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

// One row of a dropdown menu that holds more choices, like Koblip Sales'
// MenuSub. On a computer they fly out to the side (shadcn's
// DropdownMenuSub); on a phone there is no room beside the menu, so they
// open under the row, inside the same menu. `value` is the current choice,
// shown faint at the row's end.
export function MenuSub({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  children: React.ReactNode
}) {
  const phone = useIsMobile()
  const [open, setOpen] = useState(false)
  const row = (
    <>
      {icon}
      {label}
      {value && <span className="ml-auto text-muted-foreground">{value}</span>}
    </>
  )

  if (phone) {
    return (
      <>
        <DropdownMenuItem
          aria-expanded={open}
          // Opening the list must not close the menu.
          closeOnClick={false}
          onClick={() => setOpen((was) => !was)}
        >
          {row}
          <ChevronDownIcon
            className={cn(
              "transition-transform motion-reduce:transition-none",
              !value && "ml-auto",
              open && "rotate-180"
            )}
          />
        </DropdownMenuItem>
        {open && (
          <DropdownMenuGroup className="pl-6">{children}</DropdownMenuGroup>
        )}
      </>
    )
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{row}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>{children}</DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
