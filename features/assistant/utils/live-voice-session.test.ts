import { afterEach, expect, test, vi } from "vitest"

import { VOICE_RULES } from "@/lib/voice-rules"

import type { AnswerListener } from "../types"

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
  let heard = ""
  const answers: {
    write: (delta: string) => void
    lookup: () => void
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
      (_text: string, listen: AnswerListener) =>
        new Promise<Reply | null>((resolve) => {
          busy = true
          answers.push({
            write: listen.onText,
            lookup: listen.onLookup,
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
    heard: () => heard,
    forgetHeard: vi.fn(() => {
      heard = ""
    }),
    onCutOff: vi.fn(),
    close: vi.fn(),
    confirmLine: "Tap the button on the screen.",
    fillers: ["Hmm, let me see.", "Okay, almost there."],
    cutIns: ["Oh,"],
    greeting: "Hi! What can I do for you?",
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
    setHeard: (value: string) => (heard = value),
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
  t.session.hear({ type: "transcript", transcript: "what's on" })
  expect(t.parts.onCaption).toHaveBeenLastCalledWith("what's on")
  t.session.hear({
    type: "speechComplete",
    turnId: 1,
    transcript: " What's on today? ",
  })
  expect(t.parts.send).toHaveBeenCalledWith(
    "What's on today?",
    expect.any(Object)
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
  expect(t.states).toEqual(["connecting", "thinking", "talking", "listening"])
})

test("an answer ready during the first line cuts it off", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].write("Sure, pulling up today's bookings.")
  t.answers[0].lookup()
  // The first line keeps its own voice; the answer gets a new one.
  expect(t.voices[0].said).toEqual(["Sure, pulling up today's bookings."])
  expect(t.voices[0].finished).toBe(true)
  expect(t.voices).toHaveLength(2)
  t.setPlaying(true)
  t.voices[0].audio()
  t.answers[0].write("\n\nYou have 2 today, at 2 and 4. ")
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.parts.stopPlaying).toHaveBeenCalled()
  expect(t.voices[1].said).toEqual(["Oh, You have 2 today, at 2 and 4."])
  t.answers[0].resolve(reply("You have 2 today, at 2 and 4."))
  await flush()
  expect(t.voices[1].finished).toBe(true)
})

test("a first line that already finished is not cut", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].write("Lemme see. ")
  t.answers[0].lookup()
  t.setPlaying(true)
  t.voices[0].audio()
  t.voices[0].done()
  t.setPlaying(false)
  t.playerIdle()
  expect(t.states.at(-1)).toBe("thinking")
  t.answers[0].write("\n\nYou have 2 today. ")
  expect(t.parts.stopPlaying).not.toHaveBeenCalled()
  expect(t.voices[1].said).toEqual(["You have 2 today."])
})

test("a lookup with nothing said keeps one voice", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].lookup()
  expect(t.voices).toHaveLength(1)
  t.answers[0].write("You have 2 today. ")
  expect(t.voices[0].said).toEqual(["You have 2 today."])
})

test("talking over the first line stops both voices", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].write("Lemme see. ")
  t.answers[0].lookup()
  t.setPlaying(true)
  t.voices[0].audio()
  t.session.hear({ type: "transcript", transcript: "Wait" })
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.voices[1].cancelled).toBe(true)
})

test("talking over an answer remembers only what was heard", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Sofia?" })
  expect(t.parts.forgetHeard).toHaveBeenCalled()
  t.answers[0].write("Yep, Sofia's at 11. ")
  t.setPlaying(true)
  t.voices[0].audio()
  t.setHeard("Yep, Sofia's")
  t.session.hear({ type: "transcript", transcript: "And Stingray?" })
  expect(t.parts.onCutOff).toHaveBeenCalledWith("Yep, Sofia's")
  // Said more while it was still thinking: no second report.
  t.session.hear({
    type: "speechComplete",
    turnId: 2,
    transcript: "And Stingray?",
  })
  expect(t.parts.onCutOff).toHaveBeenCalledTimes(1)
})

test("new words while thinking report a cut-off with nothing heard", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Sofia?" })
  t.session.hear({ type: "speechComplete", turnId: 2, transcript: "Stingray?" })
  expect(t.parts.onCutOff).toHaveBeenCalledWith("")
})

test("an answer heard to the end is not a cut-off", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Sofia?" })
  t.answers[0].write("Yep. ")
  t.setPlaying(true)
  t.voices[0].audio()
  t.answers[0].resolve(reply("Yep."))
  await flush()
  t.voices[0].done()
  t.setPlaying(false)
  t.playerIdle()
  t.session.hear({ type: "transcript", transcript: "Thanks" })
  expect(t.parts.onCutOff).not.toHaveBeenCalled()
})

test("talking over the hello is not a cut-off", () => {
  const t = setup()
  t.session.opened()
  t.setPlaying(true)
  t.voices[0].audio()
  t.session.hear({ type: "transcript", transcript: "Hey" })
  expect(t.parts.onCutOff).not.toHaveBeenCalled()
})

test("says hello when talking starts, then listens", () => {
  const t = setup()
  t.session.opened()
  expect(t.voices[0].said).toEqual(["Hi! What can I do for you?"])
  expect(t.voices[0].finished).toBe(true)
  t.setPlaying(true)
  t.voices[0].audio()
  t.voices[0].done()
  t.setPlaying(false)
  t.playerIdle()
  expect(t.states).toEqual(["connecting", "listening", "talking", "listening"])
})

test("a question during the hello replaces it", () => {
  const t = setup()
  t.session.opened()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.voices).toHaveLength(2)
})

test("a noise with no words doesn't cut the voice off", () => {
  const t = setup()
  t.session.opened()
  t.setPlaying(true)
  t.session.hear({ type: "speechStart", turnId: 1 })
  t.session.hear({ type: "transcript", transcript: "  " })
  expect(t.voices[0].cancelled).toBe(false)
  expect(t.parts.stopPlaying).not.toHaveBeenCalled()
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
  expect(t.voices[0].cancelled).toBe(false)
  t.session.hear({ type: "transcript", transcript: "Wait" })
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
    expect.any(Object)
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
  expect(t.parts.send).toHaveBeenLastCalledWith("Second", expect.any(Object))
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
