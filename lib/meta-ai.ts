import "server-only"
import OpenAI from "openai"

import { ASSISTANT_NAME } from "./assistant-rules"

// The one place the text model name lives.
export const META_TEXT_MODEL = "muse-spark-1.3"

// The model for talking live. A talk can't wait: measured on the real prompt
// and tools, 1.2 starts answering about a second sooner on a short phrase, and
// more evenly. Kept only while the real-AI tests pass on it
// (features/assistant/api/live-eval.test.ts).
export const META_TALK_MODEL = "muse-spark-1.2"

// The one place the image model name lives.
export const META_IMAGE_MODEL = "muse-image-1.0"

// The one place the speech-to-text model name lives. Used by the raw
// ASR endpoint (not an OpenAI-protocol path, so callers use fetch).
export const META_VOICE_MODEL = "muse-voice-transcribe-1.0"

// The one place the live-hearing handshake lives (schema fields only,
// no key). The check route sends it to the relay per owner language.
// `keywords` biases hearing toward words it would otherwise mishear, like
// the assistant's name (https://dev.meta.ai/docs/api-reference/voice/schemas).
export const VOICE_HANDSHAKE = {
  audioEncoding: "PCM_24KHZ",
  model: META_VOICE_MODEL,
  mode: "ENDPOINTING",
  partialMode: "CUMULATIVE",
  keywords: [ASSISTANT_NAME],
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
