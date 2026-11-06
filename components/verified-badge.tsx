"use client"

import { useState } from "react"
import { touchArea } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Lucide's badge-check seal outline, filled here so it reads as a badge even when small.
const SEAL =
  "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
// A business name followed by its verified seal, as on X and Instagram.
// The seal is glued to the name's last word, so a long name that wraps
// never leaves it alone on a line. Tapping the seal (or, with a pointer,
// the name) slides the seal's word out beside it on a light blue pill;
// tapping again slides it back. The seal is the control for the keyboard
// and screen readers.
export function VerifiedName({
  name,
  label,
  className,
}: {
  name: string
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((value) => !value)
  const split = name.trimEnd().lastIndexOf(" ") + 1
  const head = name.slice(0, split)
  const last = name.slice(split)
  return (
    <>
      {head && (
        <span className="cursor-pointer" onClick={toggle}>
          {head}
        </span>
      )}
      <span className="whitespace-nowrap">
        <span className="cursor-pointer" onClick={toggle}>
          {last}
        </span>
        <VerifiedBadge
          label={label}
          open={open}
          onToggle={toggle}
          className={className}
        />
      </span>
    </>
  )
}

function VerifiedBadge({
  label,
  open,
  onToggle,
  className,
}: {
  label: string
  open: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      data-open={open || undefined}
      onClick={onToggle}
      className={cn(
        // Small to look at, but a full 44px to tap (same as every Button).
        touchArea,
        "group/verified inline-flex cursor-pointer items-center rounded-full p-0.5 text-sm font-medium tracking-normal text-verified-foreground transition-[background-color,padding] duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/30 data-open:bg-verified/15 data-open:pr-2.5",
        className
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0">
        <path
          d={SEAL}
          className="fill-verified stroke-verified"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d="m8.5 12 2.5 2.5 4.5-5"
          fill="none"
          stroke="white"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        aria-hidden="true"
        className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-data-open/verified:ml-1.5 group-data-open/verified:max-w-28 group-data-open/verified:opacity-100"
      >
        {label}
      </span>
    </button>
  )
}
