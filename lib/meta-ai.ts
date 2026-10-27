import "server-only"
import OpenAI from "openai"

// The one place the text model name lives.
export const META_TEXT_MODEL = "muse-spark-1.3"

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
