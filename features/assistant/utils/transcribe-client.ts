import type { AssistantStreamEvent } from "../types"

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]

const CODES: ErrorCode[] = [
  "rate_limited",
  "unavailable",
  "too_long",
  "not_allowed",
  "expired",
  "empty_audio",
  "bad_request",
]

export type TranscribeResult = { text: string } | { code: ErrorCode }

// Sends one WAV clip to the transcribe route. The words come back for the
// owner to read and edit; nothing is sent to the assistant from here.
export async function transcribe(
  businessId: string,
  wav: Blob
): Promise<TranscribeResult> {
  const form = new FormData()
  form.set("businessId", businessId)
  form.set("audio", wav, "voice.wav")
  try {
    const response = await fetch("/api/assistant/transcribe", {
      method: "POST",
      body: form,
    })
    const data: unknown = await response.json().catch(() => null)
    if (data && typeof data === "object") {
      if ("text" in data && typeof data.text === "string") {
        return { text: data.text }
      }
      if ("error" in data) {
        const code = CODES.find((c) => c === data.error)
        if (code) return { code }
      }
    }
    return { code: response.status === 401 ? "not_allowed" : "unavailable" }
  } catch {
    return { code: "unavailable" }
  }
}
