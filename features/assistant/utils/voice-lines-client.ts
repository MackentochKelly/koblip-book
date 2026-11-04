import type { VoiceLines } from "../types"

// What the AI wrote for this talk (POST /api/assistant/voice-lines). Null when
// the server could not answer: the talk goes on without it.
async function read(businessId: string, part: "greeting" | "cutIns") {
  try {
    const response = await fetch("/api/assistant/voice-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, part }),
    })
    return response.ok ? ((await response.json()) as unknown) : null
  } catch {
    return null
  }
}

export async function fetchVoiceGreeting(
  businessId: string
): Promise<string | null> {
  const answer = (await read(businessId, "greeting")) as {
    greeting?: string
  } | null
  return answer?.greeting ?? null
}

export async function fetchVoiceLines(
  businessId: string
): Promise<VoiceLines | null> {
  return (await read(businessId, "cutIns")) as VoiceLines | null
}
