import { expect, test, vi } from "vitest"

import {
  LiveVoiceSession,
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

// Fake parts: answers come back when the test resolves them, speaking
// finishes when the test says so.
function setup() {
  const states: string[] = []
  let busy = false
  let playing = false
  let idle = () => {}
  const answers: ((r: Reply | null) => void)[] = []
  const spoken: { text: string; onDone: () => void; cancel: () => void }[] = []
  const parts: LiveVoiceParts = {
    send: vi.fn(
      (text: string) =>
        new Promise<Reply | null>((resolve) => {
          void text
          busy = true
          answers.push((r) => {
            busy = false
            resolve(r)
          })
        })
    ),
    busy: () => busy,
    cancelAnswer: vi.fn(),
    speak: (text, handlers) => {
      const cancel = vi.fn()
      spoken.push({ text, onDone: handlers.onDone, cancel })
      return { cancel }
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
    onState: (state) => states.push(state),
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
    spoken,
    setBusy: (value: boolean) => (busy = value),
    setPlaying: (value: boolean) => (playing = value),
    playerIdle: () => idle(),
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test("a finished sentence is sent and its answer spoken, then it listens", async () => {
  const t = setup()
  t.session.opened()
  t.session.hear({ type: "transcript", transcript: "what's on" })
  expect(t.parts.onCaption).toHaveBeenLastCalledWith("what's on")
  t.session.hear({
    type: "speechComplete",
    turnId: 1,
    transcript: " What's on today? ",
  })
  expect(t.parts.send).toHaveBeenCalledWith("What's on today?")
  t.answers[0](reply("You have 3 bookings."))
  await flush()
  expect(t.spoken[0].text).toBe("You have 3 bookings.")
  t.setPlaying(true)
  t.spoken[0].onDone()
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

test("an answer waiting for a tap says so", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Book Ana" })
  t.answers[0](reply("Ana at 3pm.", true))
  await flush()
  expect(t.spoken[0].text).toBe("Ana at 3pm. Tap the button on the screen.")
})

test("talking over the answer stops it", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.answers[0](reply("Hello, how can I help?"))
  await flush()
  t.setPlaying(true)
  t.session.hear({ type: "speechStart", turnId: 2 })
  expect(t.spoken[0].cancel).toHaveBeenCalled()
  expect(t.parts.stopPlaying).toHaveBeenCalled()
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
  expect(t.parts.send).toHaveBeenCalledTimes(1)
  // The cancelled answer arrives anyway: it is never spoken.
  t.answers[0](reply("You have 3 today."))
  await flush()
  expect(t.spoken).toEqual([])
  // Once the chat has let go of it, the new words go.
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith("and tomorrow")
  t.answers[1](reply("3 today and 2 tomorrow."))
  await flush()
  expect(t.spoken[0].text).toBe("3 today and 2 tomorrow.")
})

test("words said before the screen catches up wait for idle", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "First" })
  // No words to speak; the screen has not redrawn yet, so still busy.
  t.answers[0](reply(""))
  t.setBusy(true)
  await flush()
  t.session.hear({ type: "speechComplete", turnId: 2, transcript: "Second" })
  expect(t.parts.cancelAnswer).not.toHaveBeenCalled()
  expect(t.parts.send).toHaveBeenCalledTimes(1)
  t.setBusy(false)
  t.session.idle()
  expect(t.parts.send).toHaveBeenLastCalledWith("Second")
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

test("nothing happens after the end", async () => {
  const t = setup()
  t.session.hear({ type: "speechComplete", turnId: 1, transcript: "Hi" })
  t.session.end()
  t.answers[0](reply("Hello"))
  await flush()
  expect(t.spoken).toEqual([])
})
