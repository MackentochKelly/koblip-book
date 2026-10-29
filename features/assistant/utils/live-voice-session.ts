import { VOICE_RULES } from "@/lib/voice-rules"

import type { AssistantStreamEvent } from "../types"
import type { ChatItem } from "./chat-state"

// Talking mode, like ChatGPT voice: the owner speaks, Meta hears it live
// (through our /api/voice/listen relay), the assistant answers in the chat,
// and ElevenLabs reads the answer out. Talking over it stops it.
// Sources: docs/assistant-plan.md, section 11.
//
// This class only decides what happens when; the microphone, the sockets
// and the speaker come in as `parts`, so tests drive it without a browser.

export type LiveVoiceState = "connecting" | "listening" | "thinking" | "talking"

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]
export type LiveVoiceError = ErrorCode | "mic_denied"

export type Reply = Extract<ChatItem, { role: "assistant" }>

// Server events the relay forwards
// (https://dev.meta.ai/docs/api-reference/voice/schemas), plus its own
// { type: "error", code }. Unknown types are ignored.
export type ListenEvent =
  | { type: "speechStart"; turnId: number }
  | { type: "transcript"; transcript: string }
  | { type: "speechEnd"; turnId: number }
  | { type: "speechComplete"; turnId: number; transcript: string }
  | { type: "error"; code: ErrorCode }

export interface LiveVoiceParts {
  // Sends the turn to the assistant; resolves with its reply.
  send: (text: string) => Promise<Reply | null>
  // Cancels the answer still being written (the owner said more).
  cancelAnswer: () => void
  // True while an answer is still being written. It must come from the
  // screen as last drawn, the same state `send` uses.
  busy: () => boolean
  // Reads text out; calls onDone once every chunk has arrived.
  speak: (
    text: string,
    handlers: { onDone: () => void; onError: () => void }
  ) => { cancel: () => void }
  // The speaker: still playing, cut off, and told when it falls silent.
  playing: () => boolean
  stopPlaying: () => void
  onPlayerIdle: (callback: () => void) => void
  // Closes the microphone and the listening socket.
  close: () => void
  confirmLine: string
  onState: (state: LiveVoiceState) => void
  onCaption: (text: string) => void
  onError: (error: LiveVoiceError) => void
  onEnd: () => void
}

export class LiveVoiceSession {
  private ended = false
  private speech: { cancel: () => void } | null = null
  // What the owner said that the assistant has not been asked yet.
  private queued = ""
  private thinking = false
  // Counts questions, so the answer to one the owner talked over is
  // dropped when it arrives.
  private turn = 0

  constructor(private readonly parts: LiveVoiceParts) {
    parts.onState("connecting")
  }

  // The listening socket is open.
  opened() {
    if (!this.ended) this.parts.onState("listening")
  }

  hear(event: ListenEvent) {
    if (this.ended) return
    switch (event.type) {
      case "speechStart":
        // The owner talked over the answer: stop it and listen.
        if (this.speech || this.parts.playing()) {
          this.stopSpeaking()
          this.parts.onState("listening")
        }
        break
      case "transcript":
        this.parts.onCaption(event.transcript)
        break
      case "speechComplete": {
        this.parts.onCaption("")
        const text = event.transcript.trim()
        if (!text) break
        this.queued = this.queued ? `${this.queued} ${text}` : text
        // Like ChatGPT voice (OpenAI Realtime `interrupt_response`): new
        // words cancel the answer being written, and the assistant answers
        // again with everything said so far. Nothing waits in line.
        if (this.thinking) {
          this.turn += 1
          this.thinking = false
          this.parts.cancelAnswer()
          // Sent from idle() once the chat has let go of the old answer.
          break
        }
        void this.ask()
        break
      }
      case "error":
        this.parts.onError(event.code)
        this.end()
        break
    }
  }

  // The listening socket closed by itself. 1000: the session reached its
  // time limit and ended cleanly.
  closed(code: number) {
    if (this.ended) return
    if (code !== 1000) this.parts.onError("unavailable")
    this.end()
  }

  // The chat finished an answer and the screen has caught up: a turn that
  // waited for it can go now.
  idle() {
    if (this.ended || this.thinking || this.speech || this.parts.playing()) {
      return
    }
    if (this.queued) void this.ask()
  }

  end() {
    if (this.ended) return
    this.ended = true
    this.queued = ""
    this.stopSpeaking()
    this.parts.close()
    this.parts.onCaption("")
    this.parts.onEnd()
  }

  private stopSpeaking() {
    this.speech?.cancel()
    this.speech = null
    this.parts.stopPlaying()
  }

  // While the chat is still busy (or has not redrawn since its last
  // answer, or is letting go of a cancelled one), it waits for idle().
  private async ask() {
    if (!this.queued || this.thinking || this.parts.busy()) return
    const text = this.queued
    this.queued = ""
    this.turn += 1
    const turn = this.turn
    this.thinking = true
    this.parts.onState("thinking")
    const reply = await this.parts.send(text)
    // Talked over: the newer question is already on its way.
    if (this.ended || turn !== this.turn) return
    this.thinking = false
    this.say(reply)
  }

  // Reads the reply out, then listens again (or sends the queued turn).
  private say(reply: Reply | null) {
    const waitsForTap = reply?.confirms.some((c) => c.state === "pending")
    const text = [reply?.text ?? "", waitsForTap ? this.parts.confirmLine : ""]
      .join(" ")
      .trim()
    if (!text) return this.next()

    this.parts.onState("talking")
    let arrived = false
    // Set before speaking starts, so even an instant reply can tell
    // whether it is still the current one.
    const turn = { cancel: () => {} }
    this.speech = turn
    this.parts.onPlayerIdle(() => {
      if (arrived && !this.speech) this.next()
    })
    const handle = this.parts.speak(text, {
      onDone: () => {
        if (this.speech !== turn) return
        arrived = true
        this.speech = null
        if (!this.parts.playing()) this.next()
      },
      onError: () => {
        if (this.speech !== turn) return
        this.speech = null
        this.parts.onError("unavailable")
        this.next()
      },
    })
    turn.cancel = handle.cancel
  }

  private next() {
    if (this.ended) return
    this.parts.onPlayerIdle(() => {})
    if (this.queued) {
      this.parts.onState("thinking")
      return void this.ask()
    }
    this.parts.onState("listening")
  }
}

// Meta hears 24 kHz in ~80 ms frames (3,840 bytes).
export const LISTEN_FRAME_SAMPLES = (VOICE_RULES.speakSampleRate * 80) / 1000
