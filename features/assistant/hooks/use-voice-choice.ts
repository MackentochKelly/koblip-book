"use client"

import { useState, useTransition } from "react"

import type { PageLanguage } from "@/lib/page-language"
import { saveOwnerVoice } from "../api/voice-actions"
import type { VoiceChoice } from "../types"

export type VoicePicking = ReturnType<typeof useVoiceChoice>

// The owner's voice for talking live: the one chosen, saving a new one,
// and whether the picker is asking for one.
export function useVoiceChoice(initial: VoiceChoice) {
  const [chosen, setChosen] = useState(initial.chosen)
  const [asking, setAsking] = useState(false)
  const [saving, startSaving] = useTransition()
  // Saves the owner's pick; false when it was not saved.
  const choose = (voiceId: string) =>
    new Promise<boolean>((resolve) =>
      startSaving(async () => {
        const result = await saveOwnerVoice(voiceId).catch(() => null)
        if (result?.ok) setChosen(voiceId)
        resolve(result?.ok === true)
      })
    )
  return {
    voices: initial.voices,
    chosen,
    saving,
    choose,
    // The voice is gone from ElevenLabs: ask again.
    forget: () => setChosen(null),
    // A voice is chosen and it speaks this language, so a talk in it can
    // start.
    speaks: (language: PageLanguage) =>
      Boolean(
        initial.voices?.find((voice) => voice.voiceId === chosen)?.previews[
          language
        ]
      ),
    asking,
    ask: () => setAsking(true),
    stopAsking: () => setAsking(false),
  }
}
