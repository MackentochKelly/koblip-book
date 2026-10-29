"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { useWakeLock } from "@/hooks/use-wake-lock"
import { VOICE_RULES } from "@/lib/voice-rules"
import type { AnswerListener } from "../types"
import {
  LISTEN_FRAME_SAMPLES,
  LiveVoiceSession,
  type ListenEvent,
  type LiveVoiceError,
  type LiveVoiceState,
  type Reply,
} from "../utils/live-voice-session"
import {
  createFramer,
  createResampler,
  floatToPcm16,
  level,
} from "../utils/pcm"
import { PcmPlayer } from "../utils/pcm-player"
import { openSpeech } from "../utils/speak-client"

export type { LiveVoiceError, LiveVoiceState }

// MDN lists "all" (remove every sound the device plays, so the assistant
// doesn't hear itself); TypeScript's DOM types only know true/false yet.
// Browsers without it treat the request as plain echo cancellation.
// https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation
const MIC_CONSTRAINTS = {
  echoCancellation: { ideal: "all" },
  noiseSuppression: true,
  autoGainControl: true,
} as unknown as MediaTrackConstraints

// Talking live needs the microphone and an audio worklet (Safari 14.1+,
// every current Chrome and Firefox).
const noop = () => () => {}
const canTalk = () =>
  typeof AudioWorkletNode !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function"

// Connects talking mode (utils/live-voice-session.ts) to the browser: the
// microphone through the capture worklet to our relay, and the speaker.
export function useLiveVoice({
  businessId,
  voiceId,
  busy,
  send,
  stopAnswer,
  confirmLine,
  fillers,
  cutIns,
  greeting,
  onError,
}: {
  businessId: string
  voiceId: string
  busy: boolean
  send: (
    text: string,
    options: { voice: boolean; listen: AnswerListener }
  ) => Promise<Reply | null>
  // Stops an answer that is still being written (the owner said more, or
  // ended talking mode).
  stopAnswer: () => void
  // Said after an answer that waits for a tap on the screen.
  confirmLine: string
  // Short lines for a slow answer ("Hmm, let me see.").
  fillers: readonly string[]
  // Put in front of the answer when it cuts the first line off ("Oh,").
  cutIns: readonly string[]
  // Said once when talking starts.
  greeting: string
  onError: (error: LiveVoiceError) => void
}) {
  const supported = useSyncExternalStore(noop, canTalk, () => false)
  // "off" when no session is running.
  const [state, setState] = useState<LiveVoiceState | "off">("off")
  // What Meta hears so far in this turn; empty between turns.
  const [caption, setCaption] = useState("")
  const [muted, setMuted] = useState(false)

  const session = useRef<LiveVoiceSession | null>(null)
  const player = useRef<PcmPlayer | null>(null)
  const mutedRef = useRef(false)
  const inputLevel = useRef(0)
  // The props as last drawn, for the session's callbacks.
  const latest = useRef({
    busy,
    send,
    stopAnswer,
    confirmLine,
    fillers,
    cutIns,
    greeting,
    onError,
    voiceId,
  })
  useEffect(() => {
    latest.current = {
      busy,
      send,
      stopAnswer,
      confirmLine,
      fillers,
      cutIns,
      greeting,
      onError,
      voiceId,
    }
  })
  // After the screen has caught up with a finished answer, a turn that
  // waited for it can go.
  useEffect(() => {
    if (!busy) session.current?.idle()
  }, [busy])

  const start = useCallback(async () => {
    if (session.current) return
    setMuted(false)
    mutedRef.current = false
    setState("connecting")
    // Made inside the tap, so phones let it play sound.
    const context = new AudioContext()
    const fail = (error: LiveVoiceError, stream?: MediaStream) => {
      for (const track of stream?.getTracks() ?? []) track.stop()
      void context.close()
      setState("off")
      latest.current.onError(error)
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: MIC_CONSTRAINTS,
      })
    } catch {
      return fail("mic_denied")
    }
    try {
      await context.audioWorklet.addModule("/voice-capture-worklet.js")
    } catch {
      return fail("unavailable", stream)
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const query = new URLSearchParams({ businessId })
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/api/voice/listen?${query}`
    )
    const speaker = new PcmPlayer(context)
    player.current = speaker

    const current = new LiveVoiceSession({
      send: (text, listen) =>
        latest.current.send(text, { voice: true, listen }),
      busy: () => latest.current.busy,
      cancelAnswer: () => latest.current.stopAnswer(),
      openSpeech: ({ onAudio, onDone, onError }) =>
        openSpeech({
          businessId,
          voiceId: latest.current.voiceId,
          onAudio: (chunk) => {
            speaker.play(chunk)
            onAudio()
          },
          onDone,
          onError,
        }),
      playing: () => speaker.playing,
      stopPlaying: () => speaker.stop(),
      onPlayerIdle: (callback) => {
        speaker.onIdle = callback
      },
      close: () => {
        try {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "stop" }))
          }
          socket.close()
        } catch {
          // Already closed.
        }
        for (const track of stream.getTracks()) track.stop()
        void context.close()
      },
      confirmLine: latest.current.confirmLine,
      fillers: latest.current.fillers,
      cutIns: latest.current.cutIns,
      greeting: latest.current.greeting,
      onState: setState,
      onCaption: setCaption,
      onError: (error) => latest.current.onError(error),
      onEnd: () => {
        if (session.current === current) {
          session.current = null
          player.current = null
        }
        inputLevel.current = 0
        setState("off")
      },
    })
    session.current = current

    socket.onopen = () => current.opened()
    socket.onmessage = (message) => {
      if (typeof message.data !== "string") return
      try {
        current.hear(JSON.parse(message.data) as ListenEvent)
      } catch {
        // Not JSON: ignored, like unknown event types.
      }
    }
    socket.onclose = (close) => current.closed(close.code)

    // Microphone -> 24 kHz 16-bit ~80 ms frames -> the relay. While muted
    // it keeps sending silence, or Meta closes an idle session.
    const resample = createResampler(
      context.sampleRate,
      VOICE_RULES.speakSampleRate
    )
    const frame = createFramer(LISTEN_FRAME_SAMPLES)
    const capture = new AudioWorkletNode(context, "voice-capture", {
      numberOfOutputs: 0,
    })
    capture.port.onmessage = (message: MessageEvent<Float32Array>) => {
      const samples = mutedRef.current
        ? new Float32Array(message.data.length)
        : message.data
      inputLevel.current = level(samples)
      if (socket.readyState !== WebSocket.OPEN) return
      for (const pcm of frame(floatToPcm16(resample(samples)))) {
        socket.send(pcm.buffer)
      }
    }
    context.createMediaStreamSource(stream).connect(capture)
    void context.resume()
  }, [businessId])

  // Ending stops listening and speaking, and any answer still being
  // written (it stays in the chat as far as it got).
  const end = useCallback(() => {
    if (latest.current.busy) latest.current.stopAnswer()
    session.current?.end()
  }, [])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    setMuted(mutedRef.current)
  }, [])

  // The screen stays on while talking, like a phone call.
  useWakeLock(state !== "off")

  // Leaving the page ends the session.
  useEffect(() => () => session.current?.end(), [])

  const getInputVolume = useCallback(() => inputLevel.current, [])
  const getOutputVolume = useCallback(() => player.current?.volume() ?? 0, [])

  return {
    supported,
    state,
    caption,
    muted,
    start,
    end,
    toggleMute,
    getInputVolume,
    getOutputVolume,
  }
}
