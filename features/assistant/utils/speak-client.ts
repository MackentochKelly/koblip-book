import { remark } from "remark"
import strip from "strip-markdown"

// Speaks one answer through ElevenLabs Text to Dialogue
// (https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket).
// Our server mints a one-time token for each answer, so the API key never
// reaches the browser.

const markdown = remark().use(strip)

// The talking-mode prompt asks for plain speech; this keeps any stray
// Markdown (stars, links, lists) from being read out.
export function speakableText(text: string): string {
  return String(markdown.processSync(text)).replace(/\s+/g, " ").trim()
}

export type Speech = {
  // Stops speaking at once; no more audio arrives.
  cancel: () => void
}

export function speak({
  businessId,
  voiceId,
  text,
  onAudio,
  onDone,
  onError,
}: {
  businessId: string
  voiceId: string
  text: string
  // One base64 PCM chunk (VOICE_RULES.speakOutputFormat).
  onAudio: (base64: string) => void
  // Every chunk has arrived (the last one may still be playing).
  onDone: () => void
  onError: () => void
}): Speech {
  const spoken = speakableText(text)
  let cancelled = false
  let socket: WebSocket | null = null

  const finish = (callback: () => void) => {
    if (cancelled) return
    cancelled = true
    callback()
  }

  void (async () => {
    if (!spoken) return finish(onDone)
    const query = new URLSearchParams({ businessId, voiceId })
    let url: string
    let tokenVoiceId: string
    try {
      const response = await fetch(`/api/voice/speak-token?${query}`)
      if (!response.ok) return finish(onError)
      const data: { url: string; voiceId: string } = await response.json()
      url = data.url
      tokenVoiceId = data.voiceId
    } catch {
      return finish(onError)
    }
    if (cancelled) return

    socket = new WebSocket(url)
    socket.onopen = () => {
      socket?.send(JSON.stringify({ voices: [tokenVoiceId] }))
      socket?.send(
        JSON.stringify({
          inputs: [{ text: `${spoken} `, voice_id: tokenVoiceId }],
        })
      )
      socket?.send(JSON.stringify({ close_socket: true }))
    }
    socket.onmessage = (event) => {
      if (cancelled || typeof event.data !== "string") return
      const message: { audio?: string; is_final?: boolean; error?: string } =
        JSON.parse(event.data)
      if (message.error) return finish(onError)
      if (message.audio) onAudio(message.audio)
      if (message.is_final) finish(onDone)
    }
    socket.onerror = () => finish(onError)
    socket.onclose = () => finish(onDone)
  })()

  return {
    cancel: () => {
      cancelled = true
      socket?.close()
    },
  }
}
