import { afterEach, expect, test, vi } from "vitest"

import { openSpeech, speakableText } from "./speak-client"

test("Markdown is stripped before speaking", () => {
  expect(
    speakableText("**Done.** You have [3 bookings](/x) today:\n\n- Ana\n- Luis")
  ).toBe("Done. You have 3 bookings today: Ana Luis")
})

// A stand-in socket that records what the page sends.
class FakeSocket {
  static OPEN = 1
  static last: FakeSocket | undefined
  readyState = 0
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  constructor(public url: string) {
    FakeSocket.last = this
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function stubToken() {
  FakeSocket.last = undefined
  vi.stubGlobal("WebSocket", FakeSocket)
  const fetchMock = vi.fn(async () =>
    Response.json({ url: "wss://speak.test/?t=1", voiceId: "voice-1" })
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function open(handlers: Partial<Parameters<typeof openSpeech>[0]> = {}) {
  return openSpeech({
    businessId: "b1",
    voiceId: "voice-1",
    onAudio: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    ...handlers,
  })
}

test("sentences said before the socket opens go out on open, each flushed", async () => {
  const fetchMock = stubToken()
  const onAudio = vi.fn()
  const onDone = vi.fn()
  const speech = open({ onAudio, onDone })
  speech.say("Let me check your **bookings**.")
  await vi.waitFor(() => expect(FakeSocket.last).toBeDefined())
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/voice/speak-token?businessId=b1&voiceId=voice-1"
  )
  const socket = FakeSocket.last!
  socket.open()
  speech.say("You have 3 today.")
  speech.finish()
  expect(socket.sent).toEqual([
    { voices: ["voice-1"] },
    { inputs: [{ text: "Let me check your bookings. ", voice_id: "voice-1" }] },
    { flush: true },
    { inputs: [{ text: "You have 3 today. ", voice_id: "voice-1" }] },
    { flush: true },
    { close_socket: true },
  ])
  socket.onmessage?.({ data: JSON.stringify({ audio: "AAAA" }) })
  socket.onmessage?.({ data: JSON.stringify({ is_final: true }) })
  socket.onclose?.()
  expect(onAudio).toHaveBeenCalledWith("AAAA")
  expect(onDone).toHaveBeenCalledTimes(1)
})

test("keeps the socket alive while it waits for words", async () => {
  stubToken()
  open()
  await vi.waitFor(() => expect(FakeSocket.last).toBeDefined())
  vi.useFakeTimers()
  const socket = FakeSocket.last!
  socket.open()
  vi.advanceTimersByTime(10_000)
  expect(socket.sent).toContainEqual({ keep_alive: true })
})

test("cancel closes the socket and drops later audio", async () => {
  stubToken()
  const onAudio = vi.fn()
  const onDone = vi.fn()
  const speech = open({ onAudio, onDone })
  await vi.waitFor(() => expect(FakeSocket.last).toBeDefined())
  const socket = FakeSocket.last!
  socket.open()
  speech.cancel()
  socket.onmessage?.({ data: JSON.stringify({ audio: "AAAA" }) })
  socket.onclose?.()
  expect(socket.closed).toBe(true)
  expect(onAudio).not.toHaveBeenCalled()
  expect(onDone).not.toHaveBeenCalled()
})

test("a socket that closes before finish is an error", async () => {
  stubToken()
  const onError = vi.fn()
  open({ onError })
  await vi.waitFor(() => expect(FakeSocket.last).toBeDefined())
  FakeSocket.last!.onclose?.()
  expect(onError).toHaveBeenCalledTimes(1)
})

test("a refused token is an error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "rate_limited" }, { status: 429 }))
  )
  const onError = vi.fn()
  open({ onError })
  await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
})
