import { afterEach, expect, test, vi } from "vitest"

import { VOICE_RULES } from "@/lib/voice-rules"

import {
  LiveVoiceSession,
  takeSentences,
  type LiveVoiceParts,
  type Reply,
} from "./live-voice-session"

function reply(text: string, pendingConfirm = false): Reply {
  return {
    id: "r",
    role: "assistant",
    text,
    steps: [],
    confirms: pendingConfirm
      ? [
          {
            id: "c",
            title: "Book",
            summary: "Ana at 3pm",
            destructive: false,
            action: "Book",
            state: "pending",
          },
        ]
      : [],
    choices: [],
    result: null,
    sources: [],
    unverified: false,
  }
}

// Fake parts: the test writes the answer's words, resolves it, and plays
// the voice's events.
function setup() {
  const states: string[] = []
  let busy = false
  let playing = false
  let idle = () => {}
  const answers: {
    write: (delta: string) => void
    resolve: (r: Reply | null) => void
  }[] = []
  const voices: {
    said: string[]
    finished: boolean
    cancelled: boolean
    audio: () => void
    done: () => void
  }[] = []
  const parts: LiveVoiceParts = {
    send: vi.fn(
      (_text: string, onText: (delta: string) => void) =>
        new Promise<Reply | null>((resolve) => {
          busy = true
          answers.push({
            write: onText,
            resolve: (r) => {
              busy = false
              resolve(r)
            },
          })
        })
    ),
    busy: () => busy,
    cancelAnswer: vi.fn(),
    openSpeech: (handlers) => {
      const voice = {
        said: [] as string[],
        finished: false,
        cancelled: false,
        audio: handlers.onAudio,
        done: handlers.onDone,
      }
      voices.push(voice)
      return {
        say: (text) => void voice.said.push(text),
        finish: () => void (voice.finished = true),
        cancel: () => void (voice.cancelled = true),
      }
    },
    playing: () => playing,
    stopPlaying: vi.fn(() => {
      playing = false
    }),
    onPlayerIdle: (callback) => {
      idle = callback
    },
    close: vi.fn(),
    confirmLine: "Tap the button on the screen.",
    fillers: ["Hmm, let me see.", "Okay, almost there."],
    onState: (state) => void states.push(state),
    onCaption: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
  }
  const session = new LiveVoiceSession(parts)
  return {
    session,
    parts,
    states,
    answers,
    voices,
    setBusy: (value: boolean) => (busy = value),
    setPlaying: (value: boolean) => (playing = value),
    playerIdle: () => idle(),
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.useRealTimers()
})

test("sentences split only where a space or line follows", () => {
  expect(takeSentences("Let me check. You have 3.5 hours")).toEqual({
    sentences: ["Let me check."],
    rest: "You have 3.5 hours",
  })
  expect(takeSentences("Done!\n\nNext line\nand")).toEqual({
    sentences: ["Done!", "Next line"],
    rest: "and",
  })
})

test("speaks each sentence as it is written, then listens", async () => {
  const t = setup()
  t.session.opened()
  t.session.hear({ type: "transcript", transcript: "what's on" })
  expect(t.parts.onCaption).toHaveBeenLastCalledWith("what's on")
  t.session.hear({
    type: "speechComplete",
    turnId: 1,
    transcript: " What's on today? ",
  })
  expect(t.parts.send).toHaveBeenCalledWith(
    "What's on today?",
    expect.any(Function)
  )
  // The voice opens while it thinks.
  expect(t.voices).toHaveLength(1)
  t.answers[0].write("Let me check your bookings.")
  expect(t.voices[0].said).toEqual([])
  t.answers[0].write("\n\nYou have 3 ")
  expect(t.voices[0].said).toEqual(["Let me check your bookings."])
  t.setPlaying(true)
  t.voices[0].audio()
  t.answers[0].write("bookings today.")
  t.answers[0].resolve(reply("Let me check…\n\nYou have 3 bookings today."))
  await flush()
  expect(t.voices[0].said).toEqual([
    "Let me check your bookings.",
    "You have 3 bookings today.",
  ])
  expect(t.voices[0].finished).toBe(true)
  t.voices[0].done()
  t.setPlaying(false)
  t.playerIdle()
  expect(t.states).toEqual([
    "connecting",
    "listening",
    "thinking",
    "talking",
    "listening",
  ])
})

test("after the first line it shows thinking until more words come", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].write("Let me check. ")
  t.setPlaying(true)
  t.voices[0].audio()
  t.setPlaying(false)
  t.playerIdle()
  expect(t.states.slice(-2)).toEqual(["talking", "thinking"])
})

test("an answer waiting for a tap says so", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Book Ana" })
  t.answers[0].resolve(reply("", true))
  await flush()
  expect(t.voices[0].said).toEqual(["Tap the button on the screen."])
})

test("a slow answer gets one short line, once", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
  expect(t.voices[0].said).toEqual(["Hmm, let me see."])
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
  expect(t.voices[0].said).toHaveLength(1)
})

test("no extra line when words came in time", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.answers[0].write("Hello there. ")
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
  expect(t.voices[0].said).toEqual(["Hello there."])
})

test("no words at all: the voice closes and it listens", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hm" })
  t.answers[0].resolve(reply(""))
  await flush()
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.states.at(-1)).toBe("listening")
})

test("talking over the voice stops it; later words stay on screen", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.answers[0].write("Hello, how can I help? ")
  t.setPlaying(true)
  t.voices[0].audio()
  t.session.hear({ type: "speechStart", turnId: 2 })
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.parts.stopPlaying).toHaveBeenCalled()
  expect(t.states.at(-1)).toBe("listening")
  t.answers[0].write("Anything else? ")
  t.answers[0].resolve(reply("Hello, how can I help? Anything else?"))
  await flush()
  expect(t.voices[0].said).toEqual(["Hello, how can I help?"])
  expect(t.states.at(-1)).toBe("listening")
})

test("more words while thinking cancel the answer and ask again", async () => {
  const t = setup()
  t.session.hear({
    type: "speechComplete",
    turnId: 1,
    transcript: "Bookings today",
  })
  t.session.hear({
    type: "speechComplete",
    turnId: 2,
    transcript: "and tomorrow",
  })
  expect(t.parts.cancelAnswer).toHaveBeenCalledTimes(1)
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.parts.send).toHaveBeenCalledTimes(1)
  // The cancelled answer's words are never spoken.
  t.answers[0].write("You have 3 today. ")
  t.answers[0].resolve(reply("You have 3 today."))
  await flush()
  expect(t.voices[0].said).toEqual([])
  // Once the chat has let go of it, the new words go.
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith(
    "and tomorrow",
    expect.any(Function)
  )
  t.answers[1].write("3 today and 2 tomorrow. ")
  expect(t.voices[1].said).toEqual(["3 today and 2 tomorrow."])
})

test("words said before the screen catches up wait for idle", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "First" })
  t.answers[0].resolve(reply(""))
  // The screen has not redrawn yet, so still busy.
  t.setBusy(true)
  await flush()
  t.session.hear({ type: "speechComplete", turnId: 2, transcript: "Second" })
  expect(t.parts.cancelAnswer).not.toHaveBeenCalled()
  expect(t.parts.send).toHaveBeenCalledTimes(1)
  t.setBusy(false)
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith("Second", expect.any(Function))
})

test("an error from the relay ends the session", () => {
  const t = setup()
  t.session.hear({ type: "error", code: "rate_limited" })
  expect(t.parts.onError).toHaveBeenCalledWith("rate_limited")
  expect(t.parts.close).toHaveBeenCalled()
  expect(t.parts.onEnd).toHaveBeenCalled()
})

test("a clean close at the time limit ends without an error", () => {
  const t = setup()
  t.session.closed(1000)
  expect(t.parts.onError).not.toHaveBeenCalled()
  expect(t.parts.onEnd).toHaveBeenCalled()
})

test("nothing is spoken after the end", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.session.end()
  t.answers[0].write("Hello. ")
  t.answers[0].resolve(reply("Hello"))
  await flush()
  expect(t.voices[0].said).toEqual([])
})
