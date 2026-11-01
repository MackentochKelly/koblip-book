"use client"

import type { ElevenLabs } from "@elevenlabs/elevenlabs-js"

import { AudioPlayerProvider } from "@/components/ui/audio-player"
import { Command, CommandGroup, CommandList } from "@/components/ui/command"
import { VoicePickerItem } from "@/components/ui/voice-picker"
import type { AssistantMessages } from "../i18n"
import type { VoiceOption } from "../types"

// The voices as ElevenLabs UI's picker rows: a tap on a row's orb plays
// the voice's ElevenLabs preview, a tap on the row chooses it.
export function VoiceList({
  voices,
  chosen,
  labels,
  onChoose,
}: {
  voices: VoiceOption[]
  chosen: string | null
  labels: AssistantMessages["voice"]
  onChoose: (voiceId: string) => void
}) {
  // ElevenLabs' label in the owner's words, or as it comes.
  const word = (value: string | undefined) =>
    value && (labels.labels[value] ?? value.replaceAll("_", " "))
  const rows: ElevenLabs.Voice[] = voices.map((voice) => ({
    voiceId: voice.voiceId,
    name: voice.name,
    previewUrl: voice.previewUrl ?? undefined,
    labels: Object.fromEntries(
      (["accent", "gender"] as const).flatMap((key) => {
        const value = word(voice.labels[key])
        return value ? [[key, value]] : []
      })
    ),
  }))
  return (
    <AudioPlayerProvider>
      <Command shouldFilter={false}>
        <CommandList>
          <CommandGroup>
            {rows.map((voice) => (
              <VoicePickerItem
                key={voice.voiceId}
                voice={voice}
                isSelected={voice.voiceId === chosen}
                onSelect={() => onChoose(voice.voiceId)}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </AudioPlayerProvider>
  )
}
