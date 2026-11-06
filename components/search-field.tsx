"use client"

import { touchArea } from "@/components/ui/button"
import { SearchIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { CONTROL_SIZE } from "@/lib/control-size"
import { cn } from "@/lib/utils"

// The app's search box above a list: the outline look of the date and
// filter buttons beside it (white with a border; see Button's outline), a
// filter chip's size (lib/control-size), a magnifier, and the input's own
// props. On a touch screen its tap area is 44px tall, like a button's,
// and a tap there types in the box. `className` goes on the box.
export function SearchField({
  className,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "type">) {
  return (
    <InputGroup
      className={cn(
        "border-border bg-background dark:bg-transparent",
        touchArea,
        CONTROL_SIZE.search,
        className
      )}
      onClick={(event) => {
        // The tap area around the box, outside the input itself.
        if (event.target === event.currentTarget)
          event.currentTarget.querySelector("input")?.focus()
      }}
    >
      <InputGroupAddon>
        <SearchIcon className="size-4" />
      </InputGroupAddon>
      <InputGroupInput type="search" {...props} />
    </InputGroup>
  )
}
