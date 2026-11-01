"use server"

import { getSession } from "@/lib/dal"
import { db } from "@/lib/db"
import { ownerVoices } from "@/lib/db/schema"
import { VOICE_RULES } from "@/lib/voice-rules"
import { isAccountVoice } from "@/lib/account-voices"

export async function saveOwnerVoice(
  voiceId: unknown
): Promise<
  { ok: true } | { ok: false; error: "unauthorized" | "unknown_voice" }
> {
  const session = await getSession()
  if (!session) {
    return { ok: false, error: "unauthorized" }
  }
  if (
    typeof voiceId !== "string" ||
    voiceId.trim() === "" ||
    voiceId.length > VOICE_RULES.maxVoiceIdLength ||
    !(await isAccountVoice(voiceId))
  ) {
    return { ok: false, error: "unknown_voice" }
  }
  await db
    .insert(ownerVoices)
    .values({ ownerId: session.userId, voiceId })
    .onConflictDoUpdate({
      target: ownerVoices.ownerId,
      set: { voiceId, updatedAt: new Date().toISOString() },
    })
  return { ok: true }
}
