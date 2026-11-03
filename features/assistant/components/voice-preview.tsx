"use client"

import { createContext, use } from "react"

import { VoiceGlobe } from "@/components/voice-globe"
import {
  AudioPlayerProvider,
  useAudioPlayer,
} from "@/components/ui/audio-player"
import { useAudioLevel } from "@/hooks/use-audio-level"
import { VOICE_RULES } from "@/lib/voice-rules"

type PreviewLevel = ReturnType<typeof useAudioLevel>

const PreviewLevelContext = createContext<PreviewLevel | null>(null)

// One player for the voice samples, shared by the voice list (which plays
// them) and the globe (which moves with them).
export function VoicePreview({ children }: { children: React.ReactNode }) {
  return (
    <AudioPlayerProvider>
      <PreviewLevel>{children}</PreviewLevel>
    </AudioPlayerProvider>
  )
}

function PreviewLevel({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer()
  const level = useAudioLevel(player.ref, VOICE_RULES.waveformFftSize)
  return <PreviewLevelContext value={level}>{children}</PreviewLevelContext>
}

// Plays and stops one sample. Call play() inside the tap, so phones let the
// globe hear it.
export function useVoicePreview() {
  const player = useAudioPlayer()
  const level = use(PreviewLevelContext)
  if (!level) throw new Error("useVoicePreview needs a VoicePreview")
  return {
    isPlaying: (id: string) => player.isItemActive(id) && player.isPlaying,
    play: (id: string, src: string) => {
      level.connect()
      void player.play({ id, src })
    },
    pause: player.pause,
  }
}

// The voice globe, moving with the sample that is playing.
export function VoicePreviewGlobe({ className }: { className?: string }) {
  const level = use(PreviewLevelContext)
  return <VoiceGlobe getOutputVolume={level?.level} className={className} />
}
