"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { useWakeLock } from "@/hooks/use-wake-lock"
import { audioLevel } from "@/lib/audio-level"
import { VOICE_RULES } from "@/lib/voice-rules"
import type { AnswerListener, CardAnswer } from "../types"
import {
  LISTEN_FRAME_SAMPLES,
  LiveVoiceSession,
  type ListenEvent,
  type LiveVoiceError,
  type LiveVoiceState,
  type Reply,
} from "../utils/live-voice-session"
import { createFramer, createResampler, floatToPcm16 } from "../utils/pcm"
import { PcmPlayer } from "../utils/pcm-player"
import { createSilenceWatch } from "../utils/silence-watch"
import { openSpeech } from "../utils/speak-client"
import { sendVoiceTiming } from "../utils/voice-timing-client"
import { fetchVoiceGreeting, fetchVoiceLines } from "../utils/voice-lines-client"

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

// Whether this browser can talk live; false on the server.
export function useLiveVoiceSupported(): boolean {
  return useSyncExternalStore(noop, canTalk, () => false)
}

export type LiveVoice = ReturnType<typeof useLiveVoice>

// Connects talking mode (utils/live-voice-session.ts) to the browser: the
// microphone through the capture worklet to our relay, and the speaker.
export function useLiveVoice({
  businessId,
  busy,
  cardWaiting,
  send,
  resume,
  stopAnswer,
  onCutOff,
  onWithdraw,
  onError,
}: {
  businessId: string
  busy: boolean
  // A card is on the screen, waiting for its yes or no.
  cardWaiting: boolean
  send: (
    text: string,
    options: { voice: boolean; listen: AnswerListener }
  ) => Promise<Reply | null>
  // Asks for an answer right after a tap on a card, with nothing new said.
  resume: (answer: CardAnswer, listen: AnswerListener) => Promise<Reply | null>
  // Stops an answer that is still being written (the owner said more, or
  // ended talking mode).
  stopAnswer: () => void
  // The owner cut an answer off; `heard` is all they got of it.
  onCutOff: (heard: string) => void
  // Takes the last question and its unfinished answer off the chat.
  onWithdraw: () => void
  onError: (error: LiveVoiceError) => void
}) {
  const supported = useLiveVoiceSupported()
  // "off" when no session is running.
  const [state, setState] = useState<LiveVoiceState | "off">("off")
  // What Meta hears so far in this turn; empty between turns.
  const [caption, setCaption] = useState("")

  const session = useRef<LiveVoiceSession | null>(null)
  const player = useRef<PcmPlayer | null>(null)
  const inputLevel = useRef(0)
  // The voice in the air, mic and answer together, for the waveform.
  const voiceAnalyser = useRef<AnalyserNode | null>(null)
  // The props as last drawn, for the session's callbacks.
  const latest = useRef({
    busy,
    cardWaiting,
    send,
    resume,
    stopAnswer,
    onCutOff,
    onWithdraw,
    onError,
  })
  useEffect(() => {
    latest.current = {
      busy,
      cardWaiting,
      send,
      resume,
      stopAnswer,
      onCutOff,
      onWithdraw,
      onError,
    }
  })
  // After the screen has caught up with a finished answer, a turn that
  // waited for it can go.
  useEffect(() => {
    if (!busy) session.current?.idle()
  }, [busy])

  const start = useCallback(async () => {
    if (session.current) return
    setState("connecting")
    const startedAt = performance.now()
    // Made inside the tap, so phones let it play sound.
    const context = new AudioContext()
    // Written from the tap, so the hello is ready about when the talk opens.
    const greeting = fetchVoiceGreeting(businessId)
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
    const lines = fetchVoiceLines(businessId)
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
    const silence = createSilenceWatch(() => session.current?.quiet())

    const current = new LiveVoiceSession({
      send: (text, listen) =>
        latest.current.send(text, { voice: true, listen }),
      resume: (answer, listen) => latest.current.resume(answer, listen),
      busy: () => latest.current.busy,
      cancelAnswer: () => latest.current.stopAnswer(),
      openSpeech: ({ onAudio, onDone, onError }) =>
        openSpeech({
          businessId,
          onAudio: (chunk, words) => {
            speaker.play(chunk, words)
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
      heard: () => speaker.heard(),
      forgetHeard: () => speaker.forget(),
      onCutOff: (heard) => latest.current.onCutOff(heard),
      withdraw: () => latest.current.onWithdraw(),
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
      random: Math.random,
      cardWaiting: () => latest.current.cardWaiting,
      now: () => performance.now(),
      startedAt,
      lastVoiceAt: () => silence.lastVoiceAt(),
      onTiming: (timing) => sendVoiceTiming(businessId, timing),
      onState: setState,
      onCaption: setCaption,
      onError: (error) => latest.current.onError(error),
      onEnd: () => {
        if (session.current === current) {
          session.current = null
          player.current = null
          voiceAnalyser.current = null
        }
        inputLevel.current = 0
        setState("off")
      },
    })
    session.current = current
    void greeting.then((written) => current.greetingReady(written))
    void lines.then((written) => current.linesReady(written))

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

    // Microphone -> 24 kHz 16-bit ~80 ms frames -> the relay.
    const resample = createResampler(
      context.sampleRate,
      VOICE_RULES.speakSampleRate
    )
    const frame = createFramer(LISTEN_FRAME_SAMPLES)
    const capture = new AudioWorkletNode(context, "voice-capture", {
      numberOfOutputs: 0,
    })
    capture.port.onmessage = (message: MessageEvent<Float32Array>) => {
      const samples = message.data
      inputLevel.current = audioLevel(samples)
      silence.hear(inputLevel.current, performance.now())
      if (socket.readyState !== WebSocket.OPEN) return
      for (const pcm of frame(floatToPcm16(resample(samples)))) {
        socket.send(pcm.buffer)
      }
    }
    // The waveform's analyser hears the microphone and the answer.
    const analyser = context.createAnalyser()
    analyser.fftSize = VOICE_RULES.waveformFftSize
    analyser.smoothingTimeConstant = VOICE_RULES.waveformSmoothing
    voiceAnalyser.current = analyser
    speaker.connect(analyser)
    const microphone = context.createMediaStreamSource(stream)
    microphone.connect(capture)
    microphone.connect(analyser)
    void context.resume()
  }, [businessId])

  // Ending stops listening and speaking, and any answer still being
  // written (it stays in the chat as far as it got).
  const end = useCallback(() => {
    if (latest.current.busy) latest.current.stopAnswer()
    session.current?.end()
  }, [])

  // A tap on the screen's buttons while talking: said, like spoken words.
  const say = useCallback((text: string) => {
    session.current?.said(text)
  }, [])

  // A tap on a card, and what it did: said out loud, and carried on from.
  const tapped = useCallback((text: string, answer: CardAnswer) => {
    session.current?.tapped(text, answer)
  }, [])

  // The screen stays on while talking, like a phone call.
  useWakeLock(state !== "off")

  // Leaving the page ends the session.
  useEffect(() => () => session.current?.end(), [])

  const getInputVolume = useCallback(() => inputLevel.current, [])
  const getOutputVolume = useCallback(() => player.current?.volume() ?? 0, [])
  // Fills `into` with the voice's loudness per pitch (0 to 255); false
  // when no session is running.
  const getVoiceFrequencies = useCallback((into: Uint8Array<ArrayBuffer>) => {
    const analyser = voiceAnalyser.current
    if (!analyser) return false
    analyser.getByteFrequencyData(into)
    return true
  }, [])

  return {
    supported,
    state,
    caption,
    start,
    end,
    say,
    tapped,
    getInputVolume,
    getOutputVolume,
    getVoiceFrequencies,
  }
}
