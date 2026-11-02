"use client"

import { MeshGradient } from "@paper-design/shaders-react"

import { useReducedMotion, useThemeColors } from "@/hooks/use-theme-colors"

// Paper's Mesh Gradient (https://shaders.paper.design/mesh-gradient): a
// fluid colour wash, set up once for the app. The colours are theme tokens
// from globals.css, read in the browser so a new theme recolours it.
const LOOKS = {
  // Slow and pale behind words, with a thin wash of the page colour over it so
  // they read more easily.
  hero: {
    colorTokens: ["--background", "--hero-1", "--hero-2", "--hero-3"],
    distortion: 0.4,
    swirl: 0.1,
    speed: 0.3,
    veiled: true,
  },
  // The voice globe has no words and is small: light colours that stand apart
  // and move fast enough to see.
  globe: {
    colorTokens: ["--chart-1", "--hero-accent", "--chart-2", "--hero-accent"],
    distortion: 0.9,
    swirl: 0.6,
    speed: 1.95,
    veiled: false,
  },
} as const

// Fills its `relative isolate` parent, behind the content.
export function HeroGradient({ look = "hero" }: { look?: keyof typeof LOOKS }) {
  const { colorTokens, distortion, swirl, speed, veiled } = LOOKS[look]
  const colors = useThemeColors(colorTokens)
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
          distortion={distortion}
          swirl={swirl}
          speed={still ? 0 : speed}
          // Fades in over the plain page colour instead of popping in.
          className="size-full duration-700 motion-safe:animate-in motion-safe:fade-in"
        />
      )}
      {veiled && <div className="absolute inset-0 bg-background/35" />}
    </div>
  )
}
