"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface FilterChip<T extends string> {
  value: T
  label: string
}

// The All chip's own value; an option's is an id or a word, never this.
const ALL = "filter-chips:all"

// A list's filter as one row of chips that scrolls sideways: shadcn's
// ToggleGroup, several on at once, All first (on when none is, and tapping
// it turns the others off). The chips are as tall as the tabs, with their
// padding; a chip that is on is filled with the main colour, like a chosen
// time in the time picker, so it clearly shows the list is filtered. The
// row fades at an edge only while more chips lie past it; its padding keeps
// each chip's 44px touch area and focus ring inside the scrolling box,
// which clips what overflows. It bleeds into the page's side padding on the
// left, and on the right ends a gap away from what follows it.
export function FilterChips<T extends string>({
  label,
  all,
  options,
  value,
  onValueChange,
  className,
}: {
  // What the chips filter, for screen readers.
  label: string
  // The All chip's words.
  all: string
  options: readonly FilterChip<T>[]
  // The chips that are on; none = All.
  value: readonly T[]
  onValueChange: (value: T[]) => void
  className?: string
}) {
  const allOn = value.length === 0
  return (
    <div
      className={cn(
        "-my-1 -mr-1 -ml-4 no-scrollbar scroll-fade-x overflow-x-auto overscroll-x-contain py-1 pr-1 pl-4",
        className
      )}
    >
      <ToggleGroup
        multiple
        variant="outline"
        aria-label={label}
        value={allOn ? [ALL] : value}
        onValueChange={(next) =>
          onValueChange(
            // All just turned on: every other chip goes off.
            !allOn && next.includes(ALL)
              ? []
              : options
                  .map((option) => option.value)
                  .filter((item) => next.includes(item))
          )
        }
      >
        {[{ value: ALL, label: all }, ...options].map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            // On, it stays filled under the pointer, as the main button does.
            className="border-border aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80 aria-pressed:hover:text-primary-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
