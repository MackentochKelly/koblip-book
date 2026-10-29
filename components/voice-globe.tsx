"use client"

import { useEffect, useRef } from "react"

import { HeroGradient } from "@/components/hero-gradient"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import { cn } from "@/lib/utils"

// How much the globe grows at full volume, and how fast it follows.
const PULSE = { maxGrow: 0.1, smoothing: 0.2 } as const
// The colours inside move a little faster than the hero's 0.3.
const GLOBE_SPEED = 0.45

// The voice globe: the hero's colour wash in a ball, lit like a sphere
// (no outline): a soft shine on the top left, light along that edge, the
// bottom right in shade, and a faint glow under it in the brand colour. While
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
        "relative isolate aspect-square overflow-hidden rounded-full shadow-[0_1.25rem_2.5rem_-1rem_color-mix(in_oklch,var(--primary)_35%,transparent)]",
        className
      )}
    >
      <HeroGradient speed={GLOBE_SPEED} veiled={false} />
      {/* Shine and edge light from the top left (the near-white
          --primary-foreground, the same in light and dark), shade on the
          bottom right (--primary), and a soft rim of light all round its
          edge, like glass, so the ball looks round. */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_24%,color-mix(in_oklch,var(--primary-foreground)_75%,transparent),transparent_28%)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary-foreground)_35%,transparent),inset_0_0_0.6rem_color-mix(in_oklch,var(--primary-foreground)_20%,transparent),inset_0.35rem_0.45rem_0.9rem_color-mix(in_oklch,var(--primary-foreground)_45%,transparent),inset_-1rem_-1.4rem_2.2rem_color-mix(in_oklch,var(--primary)_30%,transparent)]" />
    </div>
  )
}
