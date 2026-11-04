import { afterEach, expect, test, vi } from "vitest"

import { VOICE_RULES } from "@/lib/voice-rules"

import type { AnswerListener, CardAnswer } from "../types"

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
    times: null,
    result: null,
    sources: [],
    memory: [],
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
    fail: (error: "no_voice" | "unavailable") => void
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
    resume: vi.fn(
      (_answer: CardAnswer, listen: AnswerListener) =>
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
        fail: handlers.onError,
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
    withdraw: vi.fn(),
    close: vi.fn(),
    random: () => 0,
    onState: (state) => void states.push(state),
    onCaption: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
  }
  const session = new LiveVoiceSession(parts)
  // The lines the AI wrote for this talk.
  session.linesReady({
    fillers: ["Hmm, let me see.", "Okay, almost there.", "One moment."],
    cutIns: ["Oh,", "Right,"],
  })
  session.greetingReady("Hi! What can I do for you?")
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
  t.answers[0].write("Let me check. ")
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

test("a lookup with nothing said says the waiting line at once", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].lookup()
  // No quiet wait first, and on its own voice so the answer can cut it.
  expect(t.voices[0].said).toEqual(["Hmm, let me see."])
  expect(t.voices[0].finished).toBe(true)
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs * 2)
  expect(t.voices[1].said).toEqual([])
  t.answers[0].write("You have 2 today. ")
  expect(t.voices[1].said).toEqual(["You have 2 today."])
})

test("talking over the first line stops both voices", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].write("Let me check. ")
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

test("a pause before any answer joins both parts into one question", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Yeah," })
  t.session.hear({
    type: "speechComplete",
    turnId: 2,
    transcript: "Kelly Begin",
  })
  expect(t.parts.onCutOff).not.toHaveBeenCalled()
  expect(t.parts.withdraw).toHaveBeenCalled()
  // The cancelled answer lets go, then the whole question goes.
  t.answers[0].resolve(reply(""))
  await flush()
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith(
    "Yeah, Kelly Begin",
    expect.any(Object)
  )
})

test("new words after it started talking are a cut-off", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Sofia?" })
  t.answers[0].write("Let me check. ")
  t.setPlaying(true)
  t.voices[0].audio()
  t.setHeard("Let me check.")
  t.session.hear({ type: "speechComplete", turnId: 2, transcript: "Stingray?" })
  expect(t.parts.onCutOff).toHaveBeenCalledWith("Let me check.")
  expect(t.parts.withdraw).not.toHaveBeenCalled()
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

test("a card the model has no words for: what the screen says is said", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Book Ana" })
  const answer = reply("", true)
  answer.confirms[0].summary = "Ana · Cut\nFriday · 3 PM"
  t.answers[0].resolve(answer)
  await flush()
  expect(t.voices[0].said).toEqual(["Book: Ana · Cut, Friday · 3 PM"])
})

test("the model's own words about a card are all that is said", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Book Ana" })
  t.answers[0].write("That's Ana on Friday at 3, okay? ")
  t.answers[0].resolve(reply("That's Ana on Friday at 3, okay?", true))
  await flush()
  expect(t.voices[0].said).toEqual(["That's Ana on Friday at 3, okay?"])
  expect(t.voices[0].finished).toBe(true)
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

test("a line before a lookup is the answer's only waiting line", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].write("Let me check. ")
  t.answers[0].lookup()
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs * 2)
  expect(t.voices[0].said).toEqual(["Let me check."])
  expect(t.voices[1].said).toEqual([])
})

test("after the slow-answer line, a lookup adds no second one", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
  t.answers[0].lookup()
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs * 2)
  expect(t.voices[0].said).toEqual(["Hmm, let me see."])
  expect(t.voices[1].said).toEqual([])
})

test("the answer cuts the slow-answer line off mid-word", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
  // The line has its own voice, so the answer can stop it.
  expect(t.voices).toHaveLength(2)
  t.setPlaying(true)
  t.voices[0].audio()
  t.answers[0].write("You have 2 today. ")
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.parts.stopPlaying).toHaveBeenCalled()
  expect(t.voices[1].said).toEqual(["Oh, You have 2 today."])
})

test("each waiting line is said once in a talk, then there are none", async () => {
  vi.useFakeTimers()
  const t = setup()
  const questions = ["One?", "Two?", "Three?", "Four?", "Five?"]
  for (const [turn, question] of questions.entries()) {
    t.session.hear({
      type: "speechComplete",
      turnId: turn + 1,
      transcript: question,
    })
    vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
    t.answers[turn].resolve(reply("Sure."))
    await vi.runAllTimersAsync()
    t.setPlaying(false)
    t.playerIdle()
    for (const voice of t.voices) voice.done()
  }
  const lines = t.voices
    .flatMap((voice) => voice.said)
    .filter((line) => line !== "Sure." && !line.endsWith(" Sure."))
  expect(lines).toEqual(["Hmm, let me see.", "Okay, almost there.", "One moment."])
})

test("a cut-in word is said once in a talk, then the answer comes plain", async () => {
  vi.useFakeTimers()
  const t = setup()
  const said: string[] = []
  for (const [turn, question] of ["One?", "Two?", "Three?"].entries()) {
    t.session.hear({
      type: "speechComplete",
      turnId: turn + 1,
      transcript: question,
    })
    vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs)
    const voices = t.voices.length
    t.setPlaying(true)
    t.voices[voices - 2].audio()
    t.answers[turn].write("Sure. ")
    said.push(...t.voices[voices - 1].said)
    t.answers[turn].resolve(reply("Sure."))
    await vi.runAllTimersAsync()
    t.setPlaying(false)
    t.playerIdle()
    for (const voice of t.voices) voice.done()
  }
  expect(said).toEqual(["Oh, Sure.", "Right, Sure.", "Sure."])
})

test("with no lines written, a slow answer just stays quiet", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.linesReady({ fillers: [], cutIns: [] })
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Today?" })
  t.answers[0].lookup()
  vi.advanceTimersByTime(VOICE_RULES.fillerAfterMs * 2)
  expect(t.voices.flatMap((voice) => voice.said)).toEqual([])
})

test("no hello comes when the owner has already started", () => {
  const t = setup()
  t.session.opened()
  t.voices.length = 0
  const late = new LiveVoiceSession(t.parts)
  late.opened()
  late.hear({ type: "transcript", transcript: "What's" })
  late.greetingReady("Hello!")
  expect(t.voices).toEqual([])
})

test("no hello after too long a wait", () => {
  vi.useFakeTimers()
  const t = setup()
  t.session.opened()
  t.voices.length = 0
  const late = new LiveVoiceSession(t.parts)
  late.opened()
  vi.advanceTimersByTime(VOICE_RULES.greetingWaitMs)
  late.greetingReady("Hello!")
  expect(t.voices).toEqual([])
})

test("a hello written after the socket opened is still said", () => {
  const t = setup()
  t.session.opened()
  t.voices.length = 0
  const late = new LiveVoiceSession(t.parts)
  late.opened()
  expect(t.voices).toEqual([])
  late.greetingReady("Hello!")
  expect(t.voices[0].said).toEqual(["Hello!"])
})

test("a talk with no hello written just listens", () => {
  const t = setup()
  t.session.opened()
  t.voices.length = 0
  const late = new LiveVoiceSession(t.parts)
  late.opened()
  late.greetingReady(null)
  expect(t.voices).toEqual([])
  expect(t.states.at(-1)).toBe("listening")
})

test("a yes in words says the card's result", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Yes" })
  const answer = reply("")
  answer.result = { ok: true, text: "Done! Ana is booked.", kind: "bookings" }
  t.answers[0].resolve(answer)
  await flush()
  expect(t.voices[0].said).toEqual(["Done! Ana is booked."])
})

test("after a tap the model says what it did, in its own words", async () => {
  const t = setup()
  t.session.tapped("Done! Ana is booked.", "yes")
  expect(t.parts.resume).toHaveBeenCalledWith("yes", expect.any(Object))
  t.answers[0].write("Ana's all set. ")
  t.answers[0].resolve(reply("Ana's all set."))
  await flush()
  expect(t.voices[0].said).toEqual(["Ana's all set."])
  expect(t.parts.send).not.toHaveBeenCalled()
  t.voices[0].done()
  expect(t.states.at(-1)).toBe("listening")
})

test("after a tap the model can say the next card", async () => {
  const t = setup()
  t.session.tapped("Facial is added.", "yes")
  t.answers[0].write("Now Massage, is that okay? ")
  t.answers[0].resolve(reply("Now Massage, is that okay?", true))
  await flush()
  expect(t.voices[0].said).toEqual(["Now Massage, is that okay?"])
})

test("a tap's words are said when the model has none", async () => {
  const t = setup()
  t.session.tapped("Okay, nothing was changed.", "no")
  expect(t.parts.resume).toHaveBeenCalledWith("no", expect.any(Object))
  t.answers[0].resolve(null)
  await flush()
  expect(t.voices[0].said).toEqual(["Okay, nothing was changed."])
})

test("a tap with no words (it failed) asks nothing", () => {
  const t = setup()
  t.session.tapped("  ", "yes")
  expect(t.parts.resume).not.toHaveBeenCalled()
})

test("a tap while the card is being said stops it, with no cut-off", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Book Ana" })
  t.answers[0].write("Ana on Friday at 3, okay? ")
  t.answers[0].resolve(reply("Ana on Friday at 3, okay?", true))
  await flush()
  t.setPlaying(true)
  t.setHeard("Ana on Friday")
  t.session.tapped("Done! Ana is booked.", "yes")
  expect(t.parts.stopPlaying).toHaveBeenCalled()
  expect(t.parts.onCutOff).not.toHaveBeenCalled()
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.parts.resume).toHaveBeenCalledTimes(1)
})

test("a tap waits for the screen to catch up", () => {
  const t = setup()
  t.setBusy(true)
  t.session.tapped("Done! Ana is booked.", "yes")
  expect(t.parts.resume).not.toHaveBeenCalled()
  t.setBusy(false)
  t.session.idle()
  expect(t.parts.resume).toHaveBeenCalledTimes(1)
})

test("no tap talk over an answer on its way", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.session.tapped("Done! Ana is booked.", "yes")
  expect(t.parts.resume).not.toHaveBeenCalled()
})

test("words said while a tap waits go first, and the tap's talk is dropped", () => {
  const t = setup()
  t.setBusy(true)
  t.session.tapped("Done! Ana is booked.", "yes")
  t.session.said("What's next?")
  t.setBusy(false)
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith("What's next?", expect.any(Object))
  expect(t.parts.resume).not.toHaveBeenCalled()
})

test("words before any answer after a tap: only those words are asked", async () => {
  const t = setup()
  t.session.tapped("Done! Ana is booked.", "yes")
  t.session.said("And Leo?")
  expect(t.parts.withdraw).toHaveBeenCalled()
  t.answers[0].resolve(reply(""))
  await flush()
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith("And Leo?", expect.any(Object))
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
    "Bookings today and tomorrow",
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

test("a voice that can't speak says why, so the screen can ask for a voice", () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.voices[0].fail("no_voice")
  expect(t.parts.onError).toHaveBeenCalledWith("no_voice")
})

test("a clean close at the time limit ends without an error", () => {
  const t = setup()
  t.session.closed(1000)
  expect(t.parts.onError).not.toHaveBeenCalled()
  expect(t.parts.onEnd).toHaveBeenCalled()
})

test("a service restart reports unavailable and ends the browser's voice session", () => {
  const t = setup()
  t.session.closed(1012)
  expect(t.parts.onError).toHaveBeenCalledWith("unavailable")
  expect(t.parts.close).toHaveBeenCalled()
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

test("a tapped button is asked like spoken words", async () => {
  const t = setup()
  t.session.said("  Skin Fade ")
  expect(t.parts.send).toHaveBeenCalledWith("Skin Fade", expect.anything())
  t.answers[0].write("Got it, Skin Fade. ")
  t.answers[0].resolve(reply("Got it, Skin Fade."))
  await flush()
  expect(t.voices.at(-1)?.said).toEqual(["Got it, Skin Fade."])
  // Empty words ask nothing.
  t.session.said("   ")
  expect(t.parts.send).toHaveBeenCalledTimes(1)
})

test("a tap while the voice talks cuts it off, then asks", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Book Ana" })
  t.answers[0].write("Which service? ")
  t.answers[0].resolve(reply("Which service?"))
  await flush()
  t.setPlaying(true)
  t.setHeard("Which service?")
  t.session.said("Cut")
  expect(t.parts.onCutOff).toHaveBeenCalledWith("Which service?")
  expect(t.parts.stopPlaying).toHaveBeenCalled()
  expect(t.parts.send).toHaveBeenLastCalledWith("Cut", expect.anything())
})

test("a tap after the talk ended does nothing", () => {
  const t = setup()
  t.session.end()
  t.session.said("Cut")
  expect(t.parts.send).not.toHaveBeenCalled()
})

test("a yes in words: a waiting line while it books, then the result", async () => {
  const t = setup()
  t.session.hear({
    type: "speechComplete",
    turnId: 1,
    transcript: "I confirm.",
  })
  // The booking runs as a step: the waiting line comes at once.
  t.answers[0].lookup()
  expect(t.voices[0].said).toEqual(["Hmm, let me see."])
  const answer = reply("")
  answer.result = { ok: true, text: "Done! Ana is booked.", kind: "bookings" }
  t.answers[0].resolve(answer)
  await flush()
  expect(t.voices[0].cancelled).toBe(true)
  expect(t.voices[1].said).toEqual(["Done! Ana is booked."])
  expect(t.voices[1].finished).toBe(true)
})
