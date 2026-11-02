// @vitest-environment node
import { createRequire } from "node:module"
import { createServer, get } from "node:http"
import { once } from "node:events"
import { afterEach, expect, test, vi } from "vitest"
import { WebSocket, WebSocketServer } from "ws"

const { createShutdownHandler, SHUTDOWN_LIMIT_MS } =
  await import("./shutdown.mjs")

afterEach(() => vi.useRealTimers())

function setup(dev = false) {
  let closed: (error?: Error) => void = () => {}
  const order: string[] = []
  const server = {
    close: vi.fn((callback: typeof closed) => {
      order.push("stop")
      closed = callback
    }),
    closeIdleConnections: vi.fn(() => {
      order.push("idle")
    }),
    closeAllConnections: vi.fn(() => {
      order.push("all")
    }),
  }
  const client = {
    readyState: WebSocket.OPEN,
    close: vi.fn(() => {
      order.push("voice")
    }),
  }
  const app = {
    close: vi.fn(async () => {
      order.push("next")
    }),
  }
  const exit = vi.fn(() => {
    order.push("exit")
  })
  const logger = { error: vi.fn() }
  const shutdown = createShutdownHandler({
    server,
    app,
    wss: { clients: [client] },
    dev,
    limitMs: SHUTDOWN_LIMIT_MS,
    logger,
    exit,
  })
  return {
    server,
    client,
    app,
    exit,
    logger,
    shutdown,
    order,
    closed: (error?: Error) => closed(error),
  }
}

test("stops HTTP and idle connections, closes voice, then awaits Next before exiting", async () => {
  const run = setup()
  let finish: () => void = () => {}
  run.app.close.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  const done = run.shutdown("SIGINT")
  expect(run.order).toEqual(["stop", "idle", "voice"])
  expect(run.client.close).toHaveBeenCalledWith(1012)
  expect(run.server.closeAllConnections).not.toHaveBeenCalled()
  run.closed()
  await Promise.resolve()
  expect(run.app.close).toHaveBeenCalledOnce()
  expect(run.exit).not.toHaveBeenCalled()
  finish()
  await done
  expect(run.exit).toHaveBeenCalledExactlyOnceWith(130)
})

test("duplicate signals do nothing, including a different signal", async () => {
  const run = setup()
  const done = run.shutdown("SIGTERM")
  await run.shutdown("SIGINT")
  expect(run.server.close).toHaveBeenCalledOnce()
  expect(run.client.close).toHaveBeenCalledOnce()
  run.closed()
  await done
  expect(run.exit).toHaveBeenCalledExactlyOnceWith(143)
})

test("the unref'd hard limit logs cut-off work and exits only once", async () => {
  vi.useFakeTimers()
  const timers = vi.spyOn(globalThis, "setTimeout")
  const run = setup()
  const done = run.shutdown("SIGINT")
  const timer = timers.mock.results.at(-1)!.value as NodeJS.Timeout
  expect(timer.hasRef()).toBe(false)
  await vi.advanceTimersByTimeAsync(SHUTDOWN_LIMIT_MS - 1)
  expect(run.exit).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(run.logger.error).toHaveBeenCalledWith(
    expect.stringContaining("unfinished work was cut off")
  )
  expect(run.exit).toHaveBeenCalledExactlyOnceWith(130)
  run.closed()
  await done
  expect(run.exit).toHaveBeenCalledOnce()
  timers.mockRestore()
})

test.each(["http", "idle", "all", "voice", "next", "callback"])(
  "a failed %s step is logged and still exits",
  async (step) => {
    const run = setup(true)
    const error = new Error("failed")
    const fail = () => {
      throw error
    }
    if (step === "http") run.server.close.mockImplementation(fail)
    if (step === "idle")
      run.server.closeIdleConnections.mockImplementation(fail)
    if (step === "all") run.server.closeAllConnections.mockImplementation(fail)
    if (step === "voice") run.client.close.mockImplementation(fail)
    if (step === "next") run.app.close.mockRejectedValue(error)
    const done = run.shutdown("SIGTERM")
    run.closed(step === "callback" ? error : undefined)
    await done
    expect(run.logger.error).toHaveBeenCalledWith("Shutdown failed:", error)
    expect(run.exit).toHaveBeenCalledExactlyOnceWith(143)
  }
)

test("development closes all HTTP connections after stopping accepts", async () => {
  const run = setup(true)
  const done = run.shutdown("SIGINT")
  expect(run.order).toEqual(["stop", "idle", "all", "voice"])
  run.closed()
  await done
})

test("a real in-flight request can finish and schedule work before Next closes", async () => {
  let respond: () => void = () => {}
  let finishWork: () => void = () => {}
  let work: Promise<void> | undefined
  const app = { close: vi.fn(() => work) }
  const server = createServer((_request, response) => {
    respond = () => {
      work = new Promise<void>((resolve) => {
        finishWork = resolve
      })
      response.end("done")
    }
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const port = (server.address() as { port: number }).port
  const arrived = once(server, "request")
  const response = new Promise<void>((resolve, reject) => {
    get(`http://127.0.0.1:${port}`, { agent: false }, (res) => {
      res.resume()
      res.on("end", resolve)
    }).on("error", reject)
  })
  try {
    await arrived
    const exit = vi.fn()
    const shutdown = createShutdownHandler({
      server,
      app,
      wss: { clients: [] },
      dev: false,
      exit,
    })
    const done = shutdown("SIGINT")
    expect(app.close).not.toHaveBeenCalled()
    respond()
    await response
    await vi.waitFor(() => expect(app.close).toHaveBeenCalledOnce())
    expect(exit).not.toHaveBeenCalled()
    finishWork()
    await done
    expect(exit).toHaveBeenCalledWith(130)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test("a real upgraded socket receives 1012 and lets HTTP finish closing", async () => {
  const server = createServer()
  const wss = new WebSocketServer({ server })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const port = (server.address() as { port: number }).port
  const client = new WebSocket(`ws://127.0.0.1:${port}`)
  try {
    await once(client, "open")
    const closed = once(client, "close")
    const exit = vi.fn()
    const shutdown = createShutdownHandler({
      server,
      app: { close: async () => {} },
      wss,
      dev: false,
      exit,
    })
    await shutdown("SIGINT")
    expect((await closed)[0]).toBe(1012)
    expect(exit).toHaveBeenCalledWith(130)
  } finally {
    client.terminate()
    wss.close()
    server.close()
  }
})

test("PM2 runs the server directly and allows more than its shutdown limit", () => {
  const require = createRequire(import.meta.url)
  const { apps } = require("../ecosystem.config.cjs")
  expect(apps).toHaveLength(1)
  expect(apps[0]).toMatchObject({
    script: "server.mjs",
    exec_mode: "fork",
    instances: 1,
  })
  expect(apps[0].kill_timeout).toBeGreaterThan(SHUTDOWN_LIMIT_MS)
})
