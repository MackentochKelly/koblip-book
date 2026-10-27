"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Lucide's badge-check seal outline, filled here so it reads as a badge even when small.
const SEAL =
  "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
// How long the badge stays open after a tap, or after the page stops scrolling.
const OPEN_MS = 2500

// The blue verified seal with a white check, as on X and Instagram. Hovering
// it, tapping it, or scrolling the page slides its word out beside it on a
// light blue pill; it slides back once the page has been still for a moment.
export function VerifiedBadge({
  label = "Verified",
  className,
}: {
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback(() => {
    setOpen(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), OPEN_MS)
  }, [])
  useEffect(() => {
    window.addEventListener("scroll", show, { passive: true })
    return () => {
      window.removeEventListener("scroll", show)
      window.clearTimeout(timer.current)
    }
  }, [show])
  return (
    <button
      type="button"
      aria-label={label}
      data-open={open || undefined}
      onClick={show}
      className={cn(
        "group/verified inline-flex items-center rounded-full p-0.5 text-sm font-medium tracking-normal text-verified-foreground transition-[background-color,padding] duration-300 ease-out outline-none hover:bg-verified/15 hover:pr-2.5 focus-visible:ring-3 focus-visible:ring-ring/30 data-open:bg-verified/15 data-open:pr-2.5",
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
        className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-hover/verified:ml-1.5 group-hover/verified:max-w-28 group-hover/verified:opacity-100 group-data-open/verified:ml-1.5 group-data-open/verified:max-w-28 group-data-open/verified:opacity-100"
      >
        {label}
      </span>
    </button>
  )
}
