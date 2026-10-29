import { afterEach, expect, test, vi } from "vitest"

import { speak, speakableText } from "./speak-client"

test("Markdown is stripped before speaking", () => {
  expect(
    speakableText("**Done.** You have [3 bookings](/x) today:\n\n- Ana\n- Luis")
  ).toBe("Done. You have 3 bookings today: Ana Luis")
})

// A stand-in socket that records what the page sends.
class FakeSocket {
  static last: FakeSocket | undefined
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  constructor(public url: string) {
    FakeSocket.last = this
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

test("sends the voice, the text and close, then plays and finishes", async () => {
  const fetchMock = stubToken()
  const onAudio = vi.fn()
  const onDone = vi.fn()
  speak({
    businessId: "b1",
    voiceId: "voice-1",
    text: "Hello there",
    onAudio,
    onDone,
    onError: vi.fn(),
  })
  await vi.waitFor(() =>
    expect(FakeSocket.last?.url).toBe("wss://speak.test/?t=1")
  )
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/voice/speak-token?businessId=b1&voiceId=voice-1"
  )
  const socket = FakeSocket.last!
  socket.onopen?.()
  expect(socket.sent).toEqual([
    { voices: ["voice-1"] },
    { inputs: [{ text: "Hello there ", voice_id: "voice-1" }] },
    { close_socket: true },
  ])
  socket.onmessage?.({ data: JSON.stringify({ audio: "AAAA" }) })
  socket.onmessage?.({ data: JSON.stringify({ is_final: true }) })
  socket.onclose?.()
  expect(onAudio).toHaveBeenCalledWith("AAAA")
  expect(onDone).toHaveBeenCalledTimes(1)
})

test("cancel closes the socket and drops later audio", async () => {
  stubToken()
  const onAudio = vi.fn()
  const onDone = vi.fn()
  const speech = speak({
    businessId: "b1",
    voiceId: "voice-1",
    text: "Hello there",
    onAudio,
    onDone,
    onError: vi.fn(),
  })
  await vi.waitFor(() => expect(FakeSocket.last?.url).toBeTruthy())
  speech.cancel()
  const socket = FakeSocket.last!
  socket.onmessage?.({ data: JSON.stringify({ audio: "AAAA" }) })
  expect(socket.closed).toBe(true)
  expect(onAudio).not.toHaveBeenCalled()
  expect(onDone).not.toHaveBeenCalled()
})

test("a refused token is an error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "rate_limited" }, { status: 429 }))
  )
  const onError = vi.fn()
  speak({
    businessId: "b1",
    voiceId: "voice-1",
    text: "Hello",
    onAudio: vi.fn(),
    onDone: vi.fn(),
    onError,
  })
  await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
})
