import { remark } from "remark"
import strip from "strip-markdown"

import { DEFAULT_LOCALES, type PageLanguage } from "@/lib/page-language"

// Speaks one answer through ElevenLabs Text to Dialogue
// (https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket)
// while it is still being written: each sentence is sent and flushed as
// soon as it is complete, so the voice starts on the first one. Our server
// mints a one-time token for each answer, so the API key never reaches the
// browser.

const markdown = remark().use(strip)

// A 24-hour time with no AM or PM after it ("17:50", "09:00").
const DAY_CLOCK =
  /\b([01]\d|2[0-3]|\d):([0-5]\d)\b(?!\s*(?:[aApP]\.?\s?[mM]\b))/g

// "17:50" → "5:50 PM". Times from 1 to 12 with no leading zero are left
// as they are: they already read the way people say them.
function twelveHour(match: string, hours: string, minutes: string): string {
  const hour = Number(hours)
  if (hour >= 1 && hour <= 12 && !hours.startsWith("0")) return match
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`
}

// Whether times in this language say AM and PM, as its Text fields do
// (the tools write them in DEFAULT_LOCALES: en-US and es-US do, pt-BR and
// fr-FR say "17:50").
function saysAmPm(language: PageLanguage): boolean {
  const { hourCycle } = new Intl.DateTimeFormat(DEFAULT_LOCALES[language], {
    hour: "numeric",
  }).resolvedOptions()
  return hourCycle === "h11" || hourCycle === "h12"
}

// The talking-mode prompt asks for plain speech; this is the safety net
// in code that ElevenLabs suggests for text an LLM wrote
// (https://elevenlabs.io/docs/best-practices/prompting/normalization):
// stray Markdown (stars, links, lists) is stripped, separators like
// " - " and " · " become a pause, and in a language that says AM and PM,
// 24-hour times become 12-hour ones.
export function speakableText(text: string, language: PageLanguage): string {
  const plain = String(markdown.processSync(text)).replace(
    /\s+[-–—·•|]\s+/g,
    ", "
  )
  return (saysAmPm(language) ? plain.replace(DAY_CLOCK, twelveHour) : plain)
    .replace(/\s+/g, " ")
    .trim()
}

// The socket closes after 20 s without a message; this keeps it open while
// the assistant looks things up.
const KEEP_ALIVE_MS = 10_000

// Why a voice could not speak: the owner has no voice (none chosen, or
// ElevenLabs no longer has it), or anything else.
export type SpeechError = "no_voice" | "unavailable"

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
  language,
  onAudio,
  onDone,
  onError,
}: {
  businessId: string
  // The talk's language: how its times are said.
  language: PageLanguage
  // One base64 PCM chunk (VOICE_RULES.speakOutputFormat) and the words it
  // says ("" when the chunk carries none).
  onAudio: (base64: string, words: string) => void
  // Every chunk has arrived (the last one may still be playing).
  onDone: () => void
  onError: (error: SpeechError) => void
}): SpeechStream {
  let stopped = false
  let finished = false
  let socket: WebSocket | null = null
  let keepAlive: ReturnType<typeof setInterval> | undefined
  // Messages written before the socket is open go out on open.
  const pending: (() => object)[] = []
  let tokenVoiceId: string

  const stop = (callback?: () => void) => {
    if (stopped) return
    stopped = true
    clearInterval(keepAlive)
    callback?.()
  }
  const fail = (error: SpeechError = "unavailable") =>
    stop(() => onError(error))
  const send = (message: () => object) => {
    if (stopped) return
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message()))
    } else {
      pending.push(message)
    }
  }

  void (async () => {
    const query = new URLSearchParams({ businessId })
    let url: string
    try {
      const response = await fetch(`/api/voice/speak-token?${query}`)
      if (!response.ok) {
        const body: { error?: string } | null = await response
          .json()
          .catch(() => null)
        return fail(body?.error === "no_voice" ? "no_voice" : "unavailable")
      }
      const data: { url: string; voiceId: string } = await response.json()
      url = data.url
      tokenVoiceId = data.voiceId
    } catch {
      return fail()
    }
    if (stopped) return

    socket = new WebSocket(url)
    socket.onopen = () => {
      socket?.send(JSON.stringify({ voices: [tokenVoiceId] }))
      for (const message of pending.splice(0)) {
        socket?.send(JSON.stringify(message()))
      }
      keepAlive = setInterval(
        () => send(() => ({ keep_alive: true })),
        KEEP_ALIVE_MS
      )
    }
    socket.onmessage = (event) => {
      if (stopped || typeof event.data !== "string") return
      const message: {
        audio?: string
        // With sync_alignment, the characters this chunk says.
        alignment?: { chars: string[] } | null
        is_final?: boolean
        error?: string
      } = JSON.parse(event.data)
      if (message.error) return fail()
      if (message.audio) {
        onAudio(message.audio, message.alignment?.chars.join("") ?? "")
      }
      if (message.is_final) stop(onDone)
    }
    socket.onerror = () => fail()
    // Closing before finish() is a failure; after it, the end.
    socket.onclose = () => (finished ? stop(onDone) : fail())
  })()

  return {
    say: (text) => {
      const spoken = speakableText(text, language)
      if (!spoken || finished) return
      // Queued words use the voice returned by the server once connected.
      send(() => ({ inputs: [{ text: `${spoken} `, voice_id: tokenVoiceId }] }))
      send(() => ({ flush: true }))
    },
    finish: () => {
      if (finished) return
      finished = true
      send(() => ({ close_socket: true }))
    },
    cancel: () => {
      stop()
      socket?.close()
    },
  }
}
