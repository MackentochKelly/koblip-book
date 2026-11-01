import "server-only"

import { getAccountVoices, getOwnerVoiceId } from "@/lib/account-voices"
import type { PageLanguage } from "@/lib/page-language"
import type { VoiceChoice } from "../types"

// The voices an owner picks from: the account's voices that speak the
// owner's language, plus the one they chose. Each row plays a live orb, one
// WebGL canvas each, and browsers run only about 16 per page, so the whole
// account is never listed at once.
export async function getVoiceChoice(
  ownerId: string,
  language: PageLanguage
): Promise<VoiceChoice> {
  const [voices, chosen] = await Promise.all([
    getAccountVoices(),
    getOwnerVoiceId(ownerId),
  ])
  return {
    voices:
      voices
        ?.filter(
          (voice) =>
            voice.languages.includes(language) || voice.voiceId === chosen
        )
        .map(({ voiceId, name, previewUrl, labels }) => ({
          voiceId,
          name,
          previewUrl,
          labels,
        })) ?? null,
    chosen,
  }
}
