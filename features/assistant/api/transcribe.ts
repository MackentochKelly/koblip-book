import "server-only"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { PageLanguage } from "@/lib/page-language"
import { getMetaAiClient, META_VOICE_MODEL } from "@/lib/meta-ai"

// Server-side voice transcription. The browser records and converts (WAV,
// mono, 16-bit, 16 kHz); this module validates the header before Meta
// ever sees the bytes, so Meta's own 400/413 never fires for format.
// Nothing here stores or logs audio or text.

export type TranscribeError =
  | "unavailable"
  | "bad_request"
  | "too_long"
  | "empty_audio"

export type TranscribeResult = { text: string } | { code: TranscribeError }

// Meta's languageBias takes language names, not codes.
const LANGUAGE_NAMES: Record<PageLanguage, string> = {
  en: "English",
  es: "Spanish",
}

function ascii(view: DataView, offset: number, length: number): string {
  let out = ""
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(view.getUint8(offset + i))
  }
  return out
}

interface WavInfo {
  sampleRate: number
  dataLength: number
}

// Reads the RIFF/WAVE header: PCM (format 1), mono, 16-bit, 16 or 24 kHz.
// Anything else is null. Never throws on truncated input.
function readWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 12) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length)
  if (ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    return null
  }
  let fmt: {
    format: number
    channels: number
    rate: number
    bits: number
  } | null = null
  let dataLength: number | null = null
  let offset = 12
  for (let chunks = 0; chunks < 32 && offset + 8 <= bytes.length; chunks += 1) {
    const id = ascii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (body + size > bytes.length) {
      return null
    }
    if (id === "fmt " && size >= 16) {
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      }
    } else if (id === "data") {
      dataLength = size
    }
    offset = body + size + (size % 2)
  }
  if (
    !fmt ||
    dataLength === null ||
    fmt.format !== 1 ||
    fmt.channels !== 1 ||
    fmt.bits !== 16 ||
    (fmt.rate !== 16000 && fmt.rate !== 24000)
  ) {
    return null
  }
  return { sampleRate: fmt.rate, dataLength }
}

export async function transcribeVoice(
  bytes: Uint8Array,
  language: PageLanguage,
  opts?: { signal?: AbortSignal }
): Promise<TranscribeResult> {
  const client = getMetaAiClient()
  if (!client || !client.apiKey) {
    return { code: "unavailable" }
  }
  const wav = readWav(bytes)
  if (!wav) {
    return { code: "bad_request" }
  }
  if (wav.dataLength === 0) {
    // No samples: nothing could have been heard. Skip the Meta call.
    return { code: "empty_audio" }
  }
  const durationMs = (wav.dataLength / (wav.sampleRate * 2)) * 1000
  if (durationMs > ASSISTANT_RULES.maxTranscribeSeconds * 1000) {
    return { code: "too_long" }
  }
  const form = new FormData()
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          model: META_VOICE_MODEL,
          audioEncoding: "WAV",
          mode: "PUSH_TO_TALK",
          languageBias: [LANGUAGE_NAMES[language]],
        }),
      ],
      { type: "application/json" }
    )
  )
  form.append(
    "audio",
    new File([bytes as Uint8Array<ArrayBuffer>], "audio.wav", {
      type: "audio/wav",
    })
  )
  let res: Response
  try {
    res = await fetch(`${client.baseURL}/asr/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
        Accept: "application/json",
      },
      body: form,
      signal: AbortSignal.any([
        AbortSignal.timeout(ASSISTANT_RULES.modelTimeoutMs),
        ...(opts?.signal ? [opts.signal] : []),
      ]),
    })
  } catch {
    // Network failure or timeout/abort: only a short code, never detail.
    console.error("transcribe-fetch-failed")
    return { code: "unavailable" }
  }
  if (res.status === 400) {
    return { code: "bad_request" }
  }
  if (res.status === 413) {
    return { code: "too_long" }
  }
  if (res.status !== 200) {
    console.error("transcribe-meta-error", res.status)
    return { code: "unavailable" }
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    console.error("transcribe-bad-json")
    return { code: "unavailable" }
  }
  const transcript =
    typeof body === "object" && body !== null
      ? (body as { transcript?: unknown }).transcript
      : undefined
  if (typeof transcript !== "string" || transcript.trim() === "") {
    return { code: "empty_audio" }
  }
  return { text: transcript.trim() }
}
