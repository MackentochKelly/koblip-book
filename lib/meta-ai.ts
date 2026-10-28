import "server-only"
import OpenAI from "openai"

// The one place the text model name lives.
export const META_TEXT_MODEL = "muse-spark-1.3"

// The one place the speech-to-text model name lives. Used by the raw
// ASR endpoint (not an OpenAI-protocol path, so callers use fetch).
export const META_VOICE_MODEL = "muse-voice-transcribe-1.0"

// The one place the live-hearing handshake lives (schema fields only,
// no key). The check route sends it to the relay per owner language.
export const VOICE_HANDSHAKE = {
  audioEncoding: "PCM_24KHZ",
  model: META_VOICE_MODEL,
  mode: "ENDPOINTING",
  partialMode: "CUMULATIVE",
} as const

let sharedClient: OpenAI | null = null

// Says whether the AI is off: without MODEL_API_KEY the callers skip AI.
export function isMetaAiEnabled(): boolean {
  return Boolean(process.env.MODEL_API_KEY)
}

// One shared client. The SDK does not read MODEL_API_KEY by itself.
export function getMetaAiClient(): OpenAI | null {
  const apiKey = process.env.MODEL_API_KEY
  if (!apiKey) {
    return null
  }
  if (!sharedClient) {
    sharedClient = new OpenAI({
      baseURL: "https://api.meta.ai/v1",
      apiKey,
    })
  }
  return sharedClient
}
