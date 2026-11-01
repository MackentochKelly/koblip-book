import "server-only"

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"
import { eq } from "drizzle-orm"
import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { ownerVoices } from "@/lib/db/schema"
import { VOICE_RULES } from "@/lib/voice-rules"

export interface AccountVoice {
  voiceId: string
  name: string
  previewUrl: string | null
  labels: Record<string, string>
  languages: string[]
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
  ["elevenlabs-voices"],
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
