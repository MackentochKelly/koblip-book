"use client"

import { SearchIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

// The app's search box above a list: the outline look of the date and
// filter buttons beside it (white with a border; see Button's outline),
// a magnifier, and the input's own props. `className` goes on the box.
export function SearchField({
  className,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "type">) {
  return (
    <InputGroup
      className={cn(
        "border-border bg-background dark:bg-transparent",
        className
      )}
    >
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput type="search" {...props} />
    </InputGroup>
  )
}
