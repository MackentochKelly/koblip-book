import "server-only"

import { getAccountVoices, getOwnerVoiceId } from "@/lib/account-voices"
import { PAGE_LANGUAGES } from "@/lib/page-language"
import type { VoiceChoice, VoiceOption } from "../types"

// The voices an owner picks from: the account's voices with a preview in a
// page language (the picker has a tab for each), plus the one they chose.
export async function getVoiceChoice(ownerId: string): Promise<VoiceChoice> {
  const [voices, chosen] = await Promise.all([
    getAccountVoices(),
    getOwnerVoiceId(ownerId),
  ])
  return {
    voices:
      voices
        ?.map(({ voiceId, name, labels, previews }): VoiceOption => ({
          voiceId,
          name,
          labels,
          previews: Object.fromEntries(
            PAGE_LANGUAGES.flatMap((language) =>
              previews[language] ? [[language, previews[language]]] : []
            )
          ),
        }))
        .filter(
          (voice) =>
            Object.keys(voice.previews).length > 0 || voice.voiceId === chosen
        ) ?? null,
    chosen,
  }
}
