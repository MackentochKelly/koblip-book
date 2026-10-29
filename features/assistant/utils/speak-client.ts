import { remark } from "remark"
import strip from "strip-markdown"

// Speaks one answer through ElevenLabs Text to Dialogue
// (https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket)
// while it is still being written: each sentence is sent and flushed as
// soon as it is complete, so the voice starts on the first one. Our server
// mints a one-time token for each answer, so the API key never reaches the
// browser.

const markdown = remark().use(strip)

// The talking-mode prompt asks for plain speech; this keeps any stray
// Markdown (stars, links, lists) from being read out.
export function speakableText(text: string): string {
  return String(markdown.processSync(text)).replace(/\s+/g, " ").trim()
}

// The socket closes after 20 s without a message; this keeps it open while
// the assistant looks things up.
const KEEP_ALIVE_MS = 10_000

export interface SpeechStream {
  // Speaks one complete sentence (or line) now.
  say: (text: string) => void
  // No more text: the rest is spoken, then onDone.
  finish: () => void
  // Stops at once; no more audio arrives.
  cancel: () => void
}

export function openSpeech({
  businessId,
  voiceId,
  onAudio,
  onDone,
  onError,
}: {
  businessId: string
  voiceId: string
  // One base64 PCM chunk (VOICE_RULES.speakOutputFormat).
  onAudio: (base64: string) => void
  // Every chunk has arrived (the last one may still be playing).
  onDone: () => void
  onError: () => void
}): SpeechStream {
  let stopped = false
  let finished = false
  let socket: WebSocket | null = null
  let keepAlive: ReturnType<typeof setInterval> | undefined
  // Messages written before the socket is open go out on open.
  const pending: object[] = []
  let tokenVoiceId = voiceId

  const stop = (callback?: () => void) => {
    if (stopped) return
    stopped = true
    clearInterval(keepAlive)
    callback?.()
  }
  const send = (message: object) => {
    if (stopped) return
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    } else {
      pending.push(message)
    }
  }

  void (async () => {
    const query = new URLSearchParams({ businessId, voiceId })
    let url: string
    try {
      const response = await fetch(`/api/voice/speak-token?${query}`)
      if (!response.ok) return stop(onError)
      const data: { url: string; voiceId: string } = await response.json()
      url = data.url
      tokenVoiceId = data.voiceId
    } catch {
      return stop(onError)
    }
    if (stopped) return

    socket = new WebSocket(url)
    socket.onopen = () => {
      socket?.send(JSON.stringify({ voices: [tokenVoiceId] }))
      for (const message of pending.splice(0)) {
        socket?.send(JSON.stringify(message))
      }
      keepAlive = setInterval(() => send({ keep_alive: true }), KEEP_ALIVE_MS)
    }
    socket.onmessage = (event) => {
      if (stopped || typeof event.data !== "string") return
      const message: { audio?: string; is_final?: boolean; error?: string } =
        JSON.parse(event.data)
      if (message.error) return stop(onError)
      if (message.audio) onAudio(message.audio)
      if (message.is_final) stop(onDone)
    }
    socket.onerror = () => stop(onError)
    // Closing before finish() is a failure; after it, the end.
    socket.onclose = () => stop(finished ? onDone : onError)
  })()

  return {
    say: (text) => {
      const spoken = speakableText(text)
      if (!spoken || finished) return
      // The voice id is the one the token was made for (set on open; the
      // same as asked for).
      send({ inputs: [{ text: `${spoken} `, voice_id: tokenVoiceId }] })
      send({ flush: true })
    },
    finish: () => {
      if (finished) return
      finished = true
      send({ close_socket: true })
    },
    cancel: () => {
      stop()
      socket?.close()
    },
  }
}
