"use client"

import { MeshGradient } from "@paper-design/shaders-react"

import { useReducedMotion, useThemeColors } from "@/hooks/use-theme-colors"

// Paper's Mesh Gradient (https://shaders.paper.design/mesh-gradient): a
// slow fluid colour wash, set up once for the app. The colours are theme
// tokens from globals.css, read in the browser so a new theme recolours it.
const HERO_GRADIENT = {
  colorTokens: ["--background", "--chart-1", "--hero-accent", "--chart-2"],
  distortion: 0.4,
  swirl: 0.1,
  speed: 0.3,
} as const

// Fills its `relative isolate` parent, behind the content. `speed` lets a
// smaller use (the voice globe) move a little faster than the hero.
export function HeroGradient({
  speed = HERO_GRADIENT.speed,
}: {
  speed?: number
}) {
  const colors = useThemeColors(HERO_GRADIENT.colorTokens)
  const still = useReducedMotion()

  return (
    // Rounded on its own, with the box's corner size: iPhone Safari draws
    // this moving layer apart from the page and, while the page around it
    // changes (the phone search opening), stops clipping it to the box's
    // rounded corners for a moment, so they flash square.
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 [clip-path:inset(0_round_var(--radius-4xl))]"
    >
      {colors && (
        <MeshGradient
          colors={colors}
          distortion={HERO_GRADIENT.distortion}
          swirl={HERO_GRADIENT.swirl}
          speed={still ? 0 : speed}
          // Fades in over the plain page colour instead of popping in.
          className="size-full duration-700 motion-safe:animate-in motion-safe:fade-in"
        />
      )}
    </div>
  )
}
