import { VOICE_RULES } from "@/lib/voice-rules"

import type { AnswerListener, AssistantStreamEvent } from "../types"
import type { ChatItem } from "./chat-state"

// Talking mode, like ChatGPT voice: the owner speaks, Meta hears it live
// (through our /api/voice/listen relay), the assistant answers in the chat,
// and ElevenLabs reads the answer out sentence by sentence while it is
// still being written ("Lemme see…" comes first). If the answer is ready
// while that first line is still playing, it is cut off and the answer
// comes in at once ("Sure, pulling up today's… oh, you've got 2 today").
// Talking over it stops it; new words while it thinks start a fresh answer.
// Sources: docs/assistant-plan.md, sections 11 and 12.
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

// One answer's voice, open from the moment the assistant starts thinking.
export interface Speech {
  say: (text: string) => void
  finish: () => void
  cancel: () => void
}

export interface LiveVoiceParts {
  // Sends the turn to the assistant; `listen` hears the words as they are
  // written and when a lookup starts; resolves with the reply.
  send: (text: string, listen: AnswerListener) => Promise<Reply | null>
  // Cancels the answer still being written (the owner said more).
  cancelAnswer: () => void
  // True while an answer is still being written. It must come from the
  // screen as last drawn, the same state `send` uses.
  busy: () => boolean
  // Opens the voice for one answer. onAudio: a chunk started playing;
  // onDone: every chunk has arrived.
  openSpeech: (handlers: {
    onAudio: () => void
    onDone: () => void
    onError: () => void
  }) => Speech
  // The speaker: still playing, cut off, and told when it falls silent.
  playing: () => boolean
  stopPlaying: () => void
  onPlayerIdle: (callback: () => void) => void
  // The answer's words that have started playing, and a fresh start for
  // the next answer.
  heard: () => string
  forgetHeard: () => void
  // The owner cut an answer off; `heard` is all they got of it.
  onCutOff: (heard: string) => void
  // Takes the last question and its unfinished answer off the chat: the
  // owner only paused and kept talking, so both parts go as one question.
  withdraw: () => void
  // Closes the microphone and the listening socket.
  close: () => void
  // Said after an answer that waits for a tap on its card.
  confirmLine: string
  // Short natural lines for a slow answer ("Hmm, lemme see."); one is
  // said per turn, in turn.
  fillers: readonly string[]
  // Put in front of an answer that cuts the first line off ("Oh,"), in
  // turn.
  cutIns: readonly string[]
  // Said once when talking starts, like an ElevenLabs agent's first
  // message.
  greeting: string
  onState: (state: LiveVoiceState) => void
  onCaption: (text: string) => void
  onError: (error: LiveVoiceError) => void
  onEnd: () => void
}

// Splits finished sentences (or lines) off the front of the words written
// so far. A full stop only ends a sentence when a space or new line
// follows, so "3.5" or a half-written "today." waits for more.
export function takeSentences(text: string): {
  sentences: string[]
  rest: string
} {
  const sentences: string[] = []
  const end = /[.!?…]["')\]]*\s+|\n+/g
  let start = 0
  for (const match of text.matchAll(end)) {
    const stop = match.index + match[0].length
    const sentence = text.slice(start, stop).trim()
    if (sentence) sentences.push(sentence)
    start = stop
  }
  return { sentences, rest: text.slice(start) }
}

export class LiveVoiceSession {
  private ended = false
  // What the owner said that the assistant has not been asked yet.
  private queued = ""
  // An answer is being written.
  private thinking = false
  // Counts questions, so a talked-over answer's late words are dropped.
  private turn = 0
  // This turn's voice; null once it is done or the owner talked over it.
  private speech: Speech | null = null
  private spoke = false
  private speechDone = false
  private written = ""
  private filler: ReturnType<typeof setTimeout> | undefined
  private fillersUsed = 0
  // The line said before a lookup ("Lemme see…"), on its own voice so the
  // answer can cut it off: ElevenLabs can only stop audio by closing the
  // socket (https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket).
  // Null once it has finished playing or was cut off.
  private firstLine: {
    speech: Speech
    heard: boolean
    arrived: boolean
  } | null = null
  private lookedUp = false
  private cutInsUsed = 0
  // An answer is being written or spoken (not the hello).
  private answering = false
  // The words of the question being answered.
  private asked = ""

  constructor(private readonly parts: LiveVoiceParts) {
    parts.onState("connecting")
  }

  // The listening socket is open: say hello, then listen.
  opened() {
    if (this.ended) return
    this.parts.onState("listening")
    this.openVoice(this.turn, false)
    this.say(this.parts.greeting)
    this.speech?.finish()
  }

  hear(event: ListenEvent) {
    if (this.ended) return
    switch (event.type) {
      case "transcript":
        this.parts.onCaption(event.transcript)
        // The owner talked over the voice: stop it and listen. Only real
        // words count, not the start of any sound, so a cough or a door
        // doesn't cut it off ("Only respond to clear audio", OpenAI's
        // Realtime prompting guide). Words still being written stay on
        // screen only.
        if (event.transcript.trim() && (this.speech || this.parts.playing())) {
          this.cutOff()
          this.parts.onState("listening")
        }
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
          if (this.parts.heard() === "") {
            // Nothing said back yet: the owner just paused mid-thought
            // ("Yeah," … "Kelly"). Ask again with all of it, as one
            // question, like OpenAI Realtime's interrupt_response.
            this.answering = false
            this.queued = `${this.asked} ${this.queued}`
            this.stopSpeaking()
            this.parts.cancelAnswer()
            this.parts.withdraw()
          } else {
            this.cutOff()
            this.parts.cancelAnswer()
          }
          this.parts.onState("thinking")
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

  // The chat finished an answer and the screen has caught up: words that
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
    this.cutOff()
    this.parts.close()
    this.parts.onCaption("")
    this.parts.onEnd()
  }

  // Stops the voice; an answer not fully heard is remembered as only the
  // part the owner got, so the next answer can cover the rest.
  private cutOff() {
    if (this.answering) {
      this.answering = false
      this.parts.onCutOff(this.parts.heard())
    }
    this.stopSpeaking()
  }

  private stopSpeaking() {
    clearTimeout(this.filler)
    this.firstLine?.speech.cancel()
    this.firstLine = null
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
    this.asked = text
    this.turn += 1
    const turn = this.turn
    this.thinking = true
    this.lookedUp = false
    this.answering = true
    this.parts.forgetHeard()
    this.parts.onState("thinking")
    this.openVoice(turn)

    const reply = await this.parts.send(text, {
      onText: (delta) => {
        if (turn !== this.turn) return
        this.written += delta
        const { sentences, rest } = takeSentences(this.written)
        this.written = rest
        for (const sentence of sentences) this.sayAnswer(sentence)
      },
      onLookup: () => {
        if (turn !== this.turn || this.lookedUp) return
        this.lookedUp = true
        this.keepFirstLine(turn)
      },
    })
    // Talked over: the newer question is already on its way.
    if (this.ended || turn !== this.turn) return
    this.thinking = false

    // The last words, and the tap reminder when a card waits.
    const waitsForTap = reply?.confirms.some((c) => c.state === "pending")
    const rest = [this.written, waitsForTap ? this.parts.confirmLine : ""]
      .join(" ")
      .trim()
    this.written = ""
    if (rest) this.sayAnswer(rest)
    clearTimeout(this.filler)
    if (!this.speech) return this.next()
    if (!this.spoke) {
      // Nothing to say (no words came): close the voice and listen.
      this.stopSpeaking()
      return this.next()
    }
    this.speech.finish()
  }

  // Opens the voice while the assistant thinks, so the first sentence
  // plays at once, and says a short line if it stays quiet too long.
  private openVoice(turn: number, withFiller = true) {
    // A voice still going (the hello) gives way to the answer.
    if (this.speech) this.stopSpeaking()
    this.spoke = false
    this.speechDone = false
    this.written = ""
    const speech = this.parts.openSpeech({
      onAudio: () => {
        if (this.firstLine?.speech === speech) {
          this.firstLine.heard = true
          this.parts.onState("talking")
        }
        if (this.speech === speech) this.parts.onState("talking")
      },
      onDone: () => {
        if (this.firstLine?.speech === speech) {
          this.firstLine.arrived = true
          if (!this.parts.playing()) this.firstLine = null
        }
        if (this.speech !== speech) return
        this.speechDone = true
        if (!this.parts.playing()) this.afterSpeech()
      },
      onError: () => {
        if (this.speech !== speech) return
        this.speech = null
        this.parts.onError("unavailable")
        if (!this.thinking) this.next()
      },
    })
    this.speech = speech
    this.parts.onPlayerIdle(() => {
      if (this.speech !== speech) return
      if (this.firstLine?.arrived) this.firstLine = null
      if (this.speechDone) this.afterSpeech()
      // Said "Let me check…"; now waiting for the rest of the answer.
      else if (this.thinking) this.parts.onState("thinking")
    })
    const { fillers } = this.parts
    if (withFiller && fillers.length > 0) {
      this.filler = setTimeout(() => {
        if (this.spoke || turn !== this.turn || this.speech !== speech) return
        this.say(fillers[this.fillersUsed % fillers.length])
        this.fillersUsed += 1
      }, VOICE_RULES.fillerAfterMs)
    }
  }

  // A lookup started after the first line ("Lemme see…"): that line keeps
  // its voice and the answer gets a new one, so it can cut the line off.
  private keepFirstLine(turn: number) {
    if (!this.speech) return
    if (this.written.trim()) this.say(this.written)
    this.written = ""
    if (!this.spoke) return
    this.speech.finish()
    this.firstLine = { speech: this.speech, heard: false, arrived: false }
    this.speech = null
    this.openVoice(turn)
  }

  // The answer's words. If the first line is still going, it stops there
  // and the answer comes in with a short word ("Oh, you've got 2 today").
  private sayAnswer(text: string) {
    const first = this.firstLine
    if (first) {
      this.firstLine = null
      first.speech.cancel()
      this.parts.stopPlaying()
      const { cutIns } = this.parts
      if (first.heard && cutIns.length > 0) {
        text = `${cutIns[this.cutInsUsed % cutIns.length]} ${text}`
        this.cutInsUsed += 1
      }
    }
    this.say(text)
  }

  private say(text: string) {
    if (!this.speech) return
    this.spoke = true
    clearTimeout(this.filler)
    this.speech.say(text)
  }

  private afterSpeech() {
    this.speech = null
    this.next()
  }

  private next() {
    if (this.ended || this.thinking) return
    this.answering = false
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
