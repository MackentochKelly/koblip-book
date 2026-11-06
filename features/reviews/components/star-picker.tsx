"use client"

import { useTranslations } from "next-intl"

import { StarIcon } from "@/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const STARS = [1, 2, 3, 4, 5] as const

// Five stars to pick from (shadcn's Toggle Group, one pressed): every star
// up to the picked one is filled; the picked one has the toggle's pressed
// look. Each star is a 44px tap on a phone (the toggle's own).
export function StarPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number
  onChange: (stars: number) => void
  label: string
  disabled?: boolean
}) {
  const t = useTranslations("reviews")
  return (
    <ToggleGroup
      aria-label={label}
      spacing={0}
      size="lg"
      value={value ? [String(value)] : []}
      onValueChange={(next) => {
        const picked = Number(next[0])
        if (picked) onChange(picked)
      }}
      disabled={disabled}
    >
      {STARS.map((stars) => (
        <ToggleGroupItem
          key={stars}
          value={String(stars)}
          aria-label={t("stars", { n: stars })}
        >
          <StarIcon
            className={cn(
              "size-6",
              stars <= value
                ? "fill-warning text-warning"
                : "text-muted-foreground"
            )}
          />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
