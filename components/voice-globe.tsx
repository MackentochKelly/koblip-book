"use client"

import { useEffect, useRef } from "react"

import { HeroGradient } from "@/components/hero-gradient"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import { cn } from "@/lib/utils"

// How much the globe grows at full volume, and how fast it follows.
const PULSE = { maxGrow: 0.1, smoothing: 0.2 } as const

// The voice globe: a moving colour wash in a ball, lit like a real sphere (no
// outline): a small bright shine on the top left, the far side in shade, a
// little light bounced back on the bottom right, a thin rim of light all round
// and a faint glow under it in the brand colour. All of it is sized from the
// ball itself, so it looks the same at any size. While talking live it swells
// a little with the owner's voice and the answer.
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
    <div aria-hidden className={cn("@container aspect-square", className)}>
      <div
        ref={ball}
        className="relative isolate size-full overflow-hidden rounded-full shadow-[0_16cqw_31cqw_-12cqw_color-mix(in_oklch,var(--primary)_35%,transparent)]"
      >
        <HeroGradient look="globe" />
        {/* From the top layer down: the shine, the bounced light, the rim
            (all the near-white --primary-foreground, the same in light and
            dark), then the shade (--primary). */}
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_26%,color-mix(in_oklch,var(--primary-foreground)_85%,transparent),transparent_20%),radial-gradient(circle_at_70%_80%,color-mix(in_oklch,var(--primary-foreground)_30%,transparent),transparent_24%),radial-gradient(circle_closest-side,transparent_90%,color-mix(in_oklch,var(--primary-foreground)_45%,transparent)_100%),radial-gradient(circle_at_42%_38%,transparent_50%,color-mix(in_oklch,var(--primary)_35%,transparent)_80%)]" />
      </div>
    </div>
  )
}
