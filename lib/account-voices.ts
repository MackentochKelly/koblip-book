import "server-only"

import { type ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js"
import { eq } from "drizzle-orm"
import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { ownerVoices } from "@/lib/db/schema"
import { DEFAULT_LOCALES, isPageLanguage } from "@/lib/page-language"
import { VOICE_RULES } from "@/lib/voice-rules"

export interface AccountVoice {
  voiceId: string
  name: string
  previewUrl: string | null
  labels: Record<string, string>
  languages: string[]
  // Each language's own preview (the voice speaking that language), the
  // live speaking model's first.
  previews: Record<string, string>
}

// How well a verified language's preview fits: the live speaking model's
// first, then the app's own variety of the language (Brazilian Portuguese,
// docs/plans/translations.md Language scope: DEFAULT_LOCALES).
function previewFit(item: ElevenLabs.VerifiedVoiceLanguageResponseModel): number {
  const ownLocale =
    isPageLanguage(item.language) &&
    item.locale?.toLowerCase() === DEFAULT_LOCALES[item.language].toLowerCase()
  return (item.modelId === VOICE_RULES.speakModel ? 2 : 0) + (ownLocale ? 1 : 0)
}

function previewsOf(
  languages: ElevenLabs.VerifiedVoiceLanguageResponseModel[]
): Record<string, string> {
  const previews: Record<string, string> = {}
  const fits: Record<string, number> = {}
  for (const item of languages) {
    if (!item.previewUrl) continue
    const fit = previewFit(item)
    if (!(item.language in previews) || fit > fits[item.language]) {
      previews[item.language] = item.previewUrl
      fits[item.language] = fit
    }
  }
  return previews
}

// Only successful lists are cached; a failed lookup can be tried again.
const cachedAccountVoices = unstable_cache(
  async (): Promise<AccountVoice[]> => {
    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    })
    const voices: AccountVoice[] = []
    let nextPageToken: string | undefined
    do {
      const page = await client.voices
        .search({
          voiceType: "non-default",
          pageSize: 100,
          nextPageToken,
        })
        .catch(() => {
          // Cache revalidation may log errors too, so keep them plain.
          throw new Error("voices-unavailable")
        })
      voices.push(
        ...page.voices.map((voice) => ({
          voiceId: voice.voiceId,
          name: voice.name ?? voice.voiceId,
          previewUrl: voice.previewUrl ?? null,
          labels: voice.labels ?? {},
          languages: [
            ...new Set(
              (voice.verifiedLanguages ?? []).map((item) => item.language)
            ),
          ],
          previews: previewsOf(voice.verifiedLanguages ?? []),
        }))
      )
      if (!page.hasMore) break
      if (!page.nextPageToken || page.nextPageToken === nextPageToken) {
        throw new Error("voices-pagination")
      }
      nextPageToken = page.nextPageToken
    } while (nextPageToken)
    return voices.sort((a, b) => a.name.localeCompare(b.name))
  },
  // Named for the list's shape, so a list cached before previews is not read.
  ["elevenlabs-voices", "previews"],
  {
    tags: ["elevenlabs-voices"],
    revalidate: VOICE_RULES.accountVoicesCacheSeconds,
  }
)

export async function getAccountVoices(): Promise<AccountVoice[] | null> {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("voices-unavailable")
    return null
  }
  try {
    return await cachedAccountVoices()
  } catch {
    console.error("voices-unavailable")
    return null
  }
}

export async function isAccountVoice(voiceId: string): Promise<boolean> {
  return (
    (await getAccountVoices())?.some((voice) => voice.voiceId === voiceId) ??
    false
  )
}

// A removed account voice is no longer a choice the owner can use.
export async function getOwnerVoiceId(ownerId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(ownerVoices)
    .where(eq(ownerVoices.ownerId, ownerId))
    .limit(1)
  return row && (await isAccountVoice(row.voiceId)) ? row.voiceId : null
}
