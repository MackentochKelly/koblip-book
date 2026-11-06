"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EllipsisVerticalIcon } from "@/components/ui/icons"

// The ⋮ button that opens a row's or card's menu of more actions: one look
// everywhere (a round outline icon button, the filter chips' size; see
// lib/control-size). Put it inside <DropdownMenu>.
export function MoreMenuTrigger({
  label,
  className,
}: {
  // What the menu is for, for screen readers (e.g. "Actions").
  label: string
  className?: string
}) {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          className={className}
        />
      }
    >
      <EllipsisVerticalIcon />
    </DropdownMenuTrigger>
  )
}
