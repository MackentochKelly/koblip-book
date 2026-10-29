"use client"

import { Waves } from "@paper-design/shaders-react"

import { useThemeColors } from "@/hooks/use-theme-colors"

// The "pictures" on the home feature cards: Paper's Waves shader
// (shaders.paper.design/waves), thin lines on a pale field like
// dev.meta.ai's model cards. Drawn in theme tokens, so a new theme or dark
// mode recolours them. Same library as HeroGradient. Waves has no motion.
const PATTERN_TOKENS = ["--chart-1", "--primary"]

const PATTERNS = {
  calm: {
    shape: 1,
    amplitude: 0.5,
    frequency: 0.4,
    spacing: 0.3,
    rotation: -20,
  },
  zigzag: {
    shape: 0,
    amplitude: 0.4,
    frequency: 0.3,
    spacing: 0.35,
    rotation: 25,
  },
  flow: {
    shape: 2.5,
    amplitude: 0.7,
    frequency: 0.5,
    spacing: 0.3,
    rotation: 0,
  },
} as const

const LINE = { proportion: 0.06, softness: 0.3 }

export type FeaturePatternName = keyof typeof PATTERNS

export function FeaturePattern({ name }: { name: FeaturePatternName }) {
  const colors = useThemeColors(PATTERN_TOKENS)
  if (!colors) return null
  const [back, front] = colors
  return (
    <Waves
      {...PATTERNS[name]}
      {...LINE}
      colorBack={back}
      colorFront={front}
      className="size-full duration-700 motion-safe:animate-in motion-safe:fade-in"
    />
  )
}
