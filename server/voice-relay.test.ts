// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const { relayVoice } = await import("./voice-relay.mjs")

const SETTINGS = {
  handshake: {
    audioEncoding: "PCM_24KHZ",
    model: "muse-voice-transcribe-1.0",
    mode: "ENDPOINTING",
    partialMode: "CUMULATIVE",
    languageBias: ["English"],
  },
  maxSessionSeconds: 600,
  maxBufferedBytes: 1000,
  maxFrameBytes: 100,
}

class FakeSocket {
  sent: (string | Buffer)[] = []
  closedWith: number | undefined = undefined
  handlers: Record<string, ((...args: never[]) => void)[]> = {}
  on(event: string, fn: (...args: never[]) => void) {
    const list = this.handlers[event] ?? []
    list.push(fn)
    this.handlers[event] = list
  }
  send(data: string | Buffer) {
    this.sent.push(data)
  }
  close(code?: number) {
    this.closedWith = code
    for (const fn of this.handlers["close"] ?? []) {
      fn(code as never)
    }
  }
  peerMessage(data: string | Buffer, isBinary: boolean) {
    for (const fn of this.handlers["message"] ?? []) {
      fn(data as never, isBinary as never)
    }
  }
  peerOpen() {
    for (const fn of this.handlers["open"] ?? []) {
      fn()
    }
  }
  peerClose(code: number) {
    for (const fn of this.handlers["close"] ?? []) {
      fn(code as never)
    }
  }
  texts() {
    return this.sent.map((d) => d.toString())
  }
}

let client: FakeSocket
let upstream: FakeSocket
let urls: string[]

beforeEach(() => {
  client = new FakeSocket()
  upstream = new FakeSocket()
  urls = []
  relayVoice({
    client,
    openUpstream: (url: string) => {
      urls.push(url)
      return upstream
    },
    settings: SETTINGS,
    apiKey: "key123",
  })
  upstream.peerOpen()
})

afterEach(() => {
  vi.useRealTimers()
})

function ack() {
  upstream.peerMessage(JSON.stringify({ sessionId: "s1" }), false)
}

test("opens Meta and sends the handshake with the key", () => {
  expect(urls).toEqual(["wss://api.meta.ai/v1/asr/realtime"])
  expect(JSON.parse(upstream.texts()[0])).toEqual({
    ...SETTINGS.handshake,
    authorization: { accessToken: "Bearer key123" },
  })
})

test("audio before the ack is buffered and sent after it, in order", () => {
  client.peerMessage(Buffer.from([1, 2]), true)
  client.peerMessage(Buffer.from([3]), true)
  expect(upstream.sent).toHaveLength(1) // the handshake only
  ack()
  expect(upstream.sent.slice(1)).toEqual([Buffer.from([1, 2]), Buffer.from([3])])
})

test("past the buffer limit the client gets an error and both close", () => {
  client.peerMessage(Buffer.alloc(600), true)
  client.peerMessage(Buffer.alloc(500), true)
  expect(JSON.parse(client.texts().at(-1)!)).toEqual({
    type: "error",
    code: "bad_request",
  })
  expect(client.closedWith).toBeUndefined() // close() with no code
  expect(upstream.closedWith).toBeUndefined()
})

test("oversized frames are rejected but the session continues", () => {
  client.peerMessage(Buffer.alloc(101), true)
  expect(JSON.parse(client.texts().at(-1)!)).toEqual({
    type: "error",
    code: "bad_request",
  })
  ack()
  client.peerMessage(Buffer.from([9]), true)
  expect(upstream.sent.slice(-1)).toEqual([Buffer.from([9])])
})

test("turn events pass through, progress and unknown types do not", () => {
  ack()
  const frames = [
    { type: "speechStart", turnId: 1 },
    { type: "transcript", transcript: "he", final: false },
    { type: "speechEnd", turnId: 1 },
    { type: "speechComplete", turnId: 1, transcript: "hello" },
    { type: "audioProgress", audioProcessedMs: 80 },
    { type: "speaker", label: "A" },
    { type: "whatever" },
  ]
  for (const frame of frames) {
    upstream.peerMessage(JSON.stringify(frame), false)
  }
  upstream.peerMessage(Buffer.from([1]), true)
  expect(client.texts()).toEqual(frames.slice(0, 4).map((f) => JSON.stringify(f)))
})

test("an upstream error hides Meta's message and session id", () => {
  ack()
  upstream.peerMessage(
    JSON.stringify({
      type: "error",
      message: "secret backend detail",
      sessionId: "s1",
    }),
    false
  )
  expect(client.texts()).toEqual([
    JSON.stringify({ type: "error", code: "unavailable" }),
  ])
  expect(client.texts().join()).not.toContain("secret")
})

test("stop sends endStream, drops later audio, closes on upstream 1000", () => {
  ack()
  client.peerMessage(JSON.stringify({ type: "stop" }), false)
  expect(upstream.texts().at(-1)).toBe(JSON.stringify({ type: "endStream" }))
  client.peerMessage(Buffer.from([7]), true)
  expect(upstream.sent.at(-1)).toBe(JSON.stringify({ type: "endStream" }))
  upstream.peerClose(1000)
  expect(client.closedWith).toBe(1000)
})

test("each upstream close code maps to the right client code", () => {
  for (const [code, expected] of [
    [1008, "bad_request"],
    [1011, "unavailable"],
    [1013, "rate_limited"],
  ] as const) {
    const c = new FakeSocket()
    const u = new FakeSocket()
    relayVoice({
      client: c,
      openUpstream: () => u,
      settings: SETTINGS,
      apiKey: "k",
    })
    u.peerOpen()
    u.peerClose(code)
    expect(JSON.parse(c.texts().at(-1)!)).toEqual({
      type: "error",
      code: expected,
    })
  }
})

test("a client close closes upstream", () => {
  client.peerClose(1005)
  expect(upstream.closedWith).toBeUndefined()
})

test("the session timer stops the session", () => {
  vi.useFakeTimers()
  const c = new FakeSocket()
  const u = new FakeSocket()
  relayVoice({
    client: c,
    openUpstream: () => u,
    settings: { ...SETTINGS, maxSessionSeconds: 30 },
    apiKey: "k",
  })
  u.peerOpen()
  u.peerMessage(JSON.stringify({ sessionId: "s9" }), false)
  vi.advanceTimersByTime(30_000)
  expect(u.texts().at(-1)).toBe(JSON.stringify({ type: "endStream" }))
})
