"use client"

import dynamic from "next/dynamic"

import type { AgentState } from "@/components/ui/orb"
import { Skeleton } from "@/components/ui/skeleton"
import { useThemeColors } from "@/hooks/use-theme-colors"
import { cn } from "@/lib/utils"

// ElevenLabs UI's Orb (https://ui.elevenlabs.io/docs/components/orb), in the
// theme's colours. three.js is large, so it loads only when an orb is shown.
const Orb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-full" />,
})

const ORB_COLOR_TOKENS = ["--hero-accent", "--chart-2"] as const

export function VoiceOrb({
  state = null,
  getInputVolume,
  getOutputVolume,
  className,
}: {
  state?: AgentState
  getInputVolume?: () => number
  getOutputVolume?: () => number
  className?: string
}) {
  const colors = useThemeColors(ORB_COLOR_TOKENS)

  return (
    <div aria-hidden className={cn("aspect-square", className)}>
      {colors && (
        <Orb
          colors={[colors[0], colors[1]]}
          agentState={state}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
          className="size-full"
        />
      )}
    </div>
  )
}
