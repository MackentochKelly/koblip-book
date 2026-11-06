"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EllipsisVerticalIcon } from "@/components/ui/icons"

// The ⋮ button that opens a row's or card's menu of more actions: one look
// everywhere (a round outline button, small unless beside 36px controls).
// Put it inside <DropdownMenu>.
export function MoreMenuTrigger({
  label,
  size = "icon-sm",
  className,
}: {
  // What the menu is for, for screen readers (e.g. "Actions").
  label: string
  // "icon" beside 36px controls, with CONTROL_SIZE.icon (lib/control-size).
  size?: "icon-sm" | "icon"
  className?: string
}) {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          variant="outline"
          size={size}
          aria-label={label}
          className={className}
        />
      }
    >
      <EllipsisVerticalIcon />
    </DropdownMenuTrigger>
  )
}
