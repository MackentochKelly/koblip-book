"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { AssistantStreamEvent } from "../types"
import { transcribe } from "../utils/transcribe-client"
import { recordingToWav } from "../utils/wav"

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]
export type VoiceError = ErrorCode | "mic_denied"
export type VoiceState = "idle" | "recording" | "transcribing"

const noop = () => () => {}
const canRecord = () =>
  typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia

// Record, turn it into words, hand the words back. The owner reads and
// edits them before anything is sent.
export function useVoiceInput(
  businessId: string,
  onText: (text: string) => void,
  onError: (error: VoiceError) => void
) {
  const supported = useSyncExternalStore(noop, canRecord, () => false)
  const [state, setState] = useState<VoiceState>("idle")
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stop = useCallback(() => {
    clearTimeout(timer.current)
    if (recorder.current?.state === "recording") recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError("mic_denied")
      return
    }
    const chunks: Blob[] = []
    const media = new MediaRecorder(stream)
    recorder.current = media
    media.ondataavailable = (event) => chunks.push(event.data)
    media.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      setState("transcribing")
      try {
        const wav = await recordingToWav(
          new Blob(chunks, { type: media.mimeType }),
          ASSISTANT_RULES.transcribeSampleRate
        )
        const result = await transcribe(businessId, wav)
        if ("text" in result) onText(result.text)
        else onError(result.code)
      } catch {
        onError("bad_request")
      }
      setState("idle")
    }
    media.start()
    setState("recording")
    timer.current = setTimeout(stop, ASSISTANT_RULES.maxTranscribeSeconds * 1000)
  }, [businessId, onText, onError, stop])

  // Leaving the page closes the microphone.
  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
      const media = recorder.current
      if (media?.state === "recording") {
        media.onstop = null
        media.stream.getTracks().forEach((track) => track.stop())
        media.stop()
      }
    }
  }, [])

  return { supported, state, start, stop }
}
