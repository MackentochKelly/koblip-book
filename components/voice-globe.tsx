"use client"

import { useEffect, useRef } from "react"

import { HeroGradient } from "@/components/hero-gradient"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import { cn } from "@/lib/utils"

// How much the globe grows at full volume, and how fast it follows.
const PULSE = { maxGrow: 0.1, smoothing: 0.2 } as const

// The voice globe: the hero's colour wash in a ball, with a very light
// edge, a soft highlight and a shaded side so it reads as a sphere. While
// talking live it swells a little with the owner's voice and the answer.
export function VoiceGlobe({
  getInputVolume,
  getOutputVolume,
  className,
}: {
  getInputVolume?: () => number
  getOutputVolume?: () => number
  className?: string
}) {
  const ball = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()

  useEffect(() => {
    if (still || (!getInputVolume && !getOutputVolume)) return
    let level = 0
    let frame = requestAnimationFrame(function step() {
      const volume = Math.max(getInputVolume?.() ?? 0, getOutputVolume?.() ?? 0)
      level += (Math.min(volume, 1) - level) * PULSE.smoothing
      if (ball.current) {
        ball.current.style.transform = `scale(${1 + level * PULSE.maxGrow})`
      }
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [still, getInputVolume, getOutputVolume])

  return (
    <div
      ref={ball}
      aria-hidden
      className={cn(
        "relative isolate aspect-square overflow-hidden rounded-full ring-1 ring-foreground/10",
        className
      )}
    >
      <HeroGradient />
      {/* Light from the top left, shade on the bottom right. */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_26%,color-mix(in_oklch,var(--background)_55%,transparent),transparent_50%)] shadow-[inset_-0.6rem_-0.8rem_1.6rem_color-mix(in_oklch,var(--foreground)_14%,transparent)]" />
    </div>
  )
}
