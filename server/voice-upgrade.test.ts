// @vitest-environment node
import { EventEmitter } from "node:events"
import { expect, test, vi } from "vitest"

const { handleVoiceUpgrade } = await import("./voice-upgrade.mjs")
const { createVoiceSlots } = await import("./voice-slots.mjs")

const SETTINGS = {
  handshake: { model: "m" },
  maxSessionSeconds: 600,
  maxBufferedBytes: 1000,
  maxFrameBytes: 100,
  ownerId: "u1",
  maxOpenSessions: 1,
}

class FakeSocket extends EventEmitter {
  destroyed = false
  written: string[] = []
  write(data: string) {
    this.written.push(data)
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.emit("close")
  }
}

function request(origin: string | undefined) {
  return {
    url: "/api/voice/listen?businessId=b1",
    headers: { host: "site.test", origin, cookie: "s=1" },
  }
}

function run(
  options: {
    socket?: FakeSocket
    fetchImpl?: (url: string, init: RequestInit) => Promise<unknown>
    apiKey?: string
    origin?: string
    slots?: ReturnType<typeof createVoiceSlots>
    accept?: (settings: unknown) => void
    timeoutMs?: number
  } = {}
) {
  const socket = options.socket ?? new FakeSocket()
  const slots = options.slots ?? createVoiceSlots()
  const accept = vi.fn(options.accept ?? (() => {}))
  const done = handleVoiceUpgrade({
    request: request("origin" in options ? options.origin : undefined),
    socket,
    checkUrl: "http://localhost:3100/api/voice/check",
    apiKey: "apiKey" in options ? options.apiKey : "key",
    slots,
    accept,
    fetchImpl: (options.fetchImpl ??
      (async () =>
        new Response(JSON.stringify(SETTINGS), { status: 200 }))) as typeof fetch,
    timeoutMs: options.timeoutMs,
  })
  return { socket, slots, accept, done }
}

const status = (socket: FakeSocket) => socket.written[0]?.split("\r\n")[0]

test("a checked owner is accepted with the check's settings and holds a slot", async () => {
  const fetchImpl = vi.fn(
    async () => new Response(JSON.stringify(SETTINGS), { status: 200 })
  )
  const { socket, slots, accept, done } = run({
    fetchImpl,
    origin: "https://site.test",
  })
  await expect(done).resolves.toBeUndefined()
  expect(accept).toHaveBeenCalledWith(SETTINGS)
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://localhost:3100/api/voice/check?businessId=b1",
    expect.objectContaining({ headers: { cookie: "s=1" } })
  )
  expect(slots.count("u1")).toBe(1)
  // Closing the socket frees the slot.
  socket.destroy()
  expect(slots.count("u1")).toBe(0)
})

test("another or missing origin is refused before the check", async () => {
  for (const origin of ["https://evil.test", undefined, "not a url"]) {
    const fetchImpl = vi.fn()
    const { socket, accept, done } = run({ origin, fetchImpl })
    await done
    expect(status(socket)).toBe("HTTP/1.1 403 Forbidden")
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(accept).not.toHaveBeenCalled()
  }
})

test("a check that fails, hangs or refuses ends the upgrade, never the process", async () => {
  const cases: [
    (url: string, init: RequestInit) => Promise<unknown>,
    string,
  ][] = [
    [
      async () => {
        throw new Error("ECONNREFUSED")
      },
      "HTTP/1.1 503 Service Unavailable",
    ],
    [
      (_url, init) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason)
          )
        ),
      "HTTP/1.1 503 Service Unavailable",
    ],
    [
      async () => new Response("{}", { status: 401 }),
      "HTTP/1.1 401 Rejected",
    ],
    [
      async () => new Response("not json", { status: 200 }),
      "HTTP/1.1 502 Bad Gateway",
    ],
    [
      async () =>
        new Response(JSON.stringify({ ...SETTINGS, ownerId: 42 }), {
          status: 200,
        }),
      "HTTP/1.1 502 Bad Gateway",
    ],
    [
      async () =>
        new Response(JSON.stringify({ ...SETTINGS, maxOpenSessions: "2" }), {
          status: 200,
        }),
      "HTTP/1.1 502 Bad Gateway",
    ],
  ]
  for (const [fetchImpl, line] of cases) {
    const { socket, slots, accept, done } = run({
      fetchImpl,
      origin: "https://site.test",
      timeoutMs: 20,
    })
    await expect(done).resolves.toBeUndefined()
    expect(status(socket)).toBe(line)
    expect(socket.destroyed).toBe(true)
    expect(accept).not.toHaveBeenCalled()
    expect(slots.count("u1")).toBe(0)
  }
})

test("no model key refuses with 503", async () => {
  const { socket, accept, done } = run({
    apiKey: undefined,
    origin: "https://site.test",
  })
  await done
  expect(status(socket)).toBe("HTTP/1.1 503 Service Unavailable")
  expect(accept).not.toHaveBeenCalled()
})

test("a socket reset while the check runs is handled and takes no slot", async () => {
  let answer: (value: Response) => void = () => {}
  const socket = new FakeSocket()
  const { slots, accept, done } = run({
    socket,
    origin: "https://site.test",
    fetchImpl: () => new Promise((resolve) => (answer = resolve)),
  })
  // Without a listener this emit would throw (an uncaught 'error').
  expect(() => socket.emit("error", new Error("ECONNRESET"))).not.toThrow()
  expect(socket.destroyed).toBe(true)
  answer(new Response(JSON.stringify(SETTINGS), { status: 200 }))
  await done
  expect(accept).not.toHaveBeenCalled()
  expect(slots.count("u1")).toBe(0)
  expect(socket.written).toEqual([])
})

test("an owner at the open-session cap is refused with 429", async () => {
  const slots = createVoiceSlots()
  slots.take("u1", 1)
  const { socket, accept, done } = run({ slots, origin: "https://site.test" })
  await done
  expect(status(socket)).toBe("HTTP/1.1 429 Too Many Requests")
  expect(accept).not.toHaveBeenCalled()
  expect(slots.count("u1")).toBe(1)
})

test("an accept that throws frees the slot and answers 500", async () => {
  const { socket, slots, done } = run({
    origin: "https://site.test",
    accept: () => {
      throw new Error("boom")
    },
  })
  await expect(done).resolves.toBeUndefined()
  expect(status(socket)).toBe("HTTP/1.1 500 Internal Server Error")
  expect(slots.count("u1")).toBe(0)
})
