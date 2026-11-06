"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface FilterChip<T extends string> {
  value: T
  label: string
}

// A list's filter as one row of chips that scrolls sideways (a swipe on a
// phone, the row bleeding to the screen's edges): shadcn's ToggleGroup,
// several on at once, none on = everything. The chips look like the home
// page's "Made for" pills (outline, 36px tall, roomy sides); a chip that is
// on is filled with the main colour, like a chosen time in the time picker,
// so it clearly shows the list is filtered. The row's padding keeps each
// chip's 44px touch area and focus ring inside the scrolling box, which
// clips what overflows; it bleeds into the page's own side padding.
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: {
  // What the chips filter, for screen readers.
  label: string
  options: readonly FilterChip<T>[]
  value: readonly T[]
  onValueChange: (value: T[]) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "-mx-4 -my-1 no-scrollbar scroll-fade-x overflow-x-auto overscroll-x-contain px-4 py-1",
        className
      )}
    >
      <ToggleGroup
        multiple
        variant="outline"
        aria-label={label}
        value={value}
        onValueChange={(next) =>
          onValueChange(
            options
              .map((option) => option.value)
              .filter((item) => next.includes(item))
          )
        }
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            // On, it stays filled under the pointer, as the main button does.
            className="border-border px-4 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80 aria-pressed:hover:text-primary-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
