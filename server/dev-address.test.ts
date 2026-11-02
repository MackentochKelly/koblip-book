// @vitest-environment node
import { createServer, request } from "node:http"
import { once } from "node:events"
import { describe, expect, it } from "vitest"

const { devAddress, redirectDevAddress } = await import("./dev-address.mjs")

describe("devAddress", () => {
  it.each(["127.0.0.1:3100", "[::1]:3100", "dev1.localhost:3100"])(
    "redirects %s to the canonical name on the same port",
    (host) => {
      expect(devAddress(host, "/login?next=/x", "http://localhost:3100")).toBe(
        "http://localhost:3100/login?next=/x"
      )
    }
  )

  it.each(["127.0.0.1:3101", "[::1]:3101", "localhost:3101"])(
    "keeps the worktree port when redirecting %s",
    (host) => {
      expect(devAddress(host, "/", "http://dev1.localhost:3101")).toBe(
        "http://dev1.localhost:3101/"
      )
    }
  )

  it.each([
    "localhost:3100",
    "127.0.0.1:3100",
    "[::1]:3100",
    "dev1.localhost:3101",
  ])("never redirects the canonical address %s", (host) => {
    expect(devAddress(host, "/login", `http://${host}`)).toBeNull()
  })

  it.each(["127.0.0.1:3100", "[::1]:3100", "localhost:3100"])(
    "leaves %s alone when the worktree uses another port",
    (host) => {
      expect(devAddress(host, "/", "http://dev1.localhost:3101")).toBeNull()
    }
  )

  it.each([
    "192.168.1.50:3100",
    "example.com:3100",
    "localhost.example.com:3100",
    "user@localhost:3100",
    "localhost:3100/path",
    null,
  ])("does not redirect a non-loopback or invalid Host: %s", (host) => {
    expect(devAddress(host, "/", "http://localhost:3100")).toBeNull()
  })

  it.each([
    undefined,
    "",
    "not a URL",
    "http://",
    "http://localhost:bad",
    "file:///tmp/app",
  ])("ignores an unset or invalid auth URL: %s", (url) => {
    expect(devAddress("127.0.0.1:3100", "/", url)).toBeNull()
  })

  it("keeps the path and query exactly, including escapes and repeated parameters", () => {
    const path = "/login/a%2Fb?next=%2Fx%3Fa%3D1&lang=es&x=one+two&x=%2f"
    expect(devAddress("127.0.0.1:3100", path, "http://localhost:3100")).toBe(
      `http://localhost:3100${path}`
    )
  })
})

it("redirects real GET and HEAD requests before the handler, leaving POST, canonical and production requests alone", async () => {
  let dev = true
  let authUrl = ""
  let handled = 0
  const server = createServer((req, res) => {
    if (dev && redirectDevAddress(req, res, dev, authUrl)) return
    handled++
    res.end("handled")
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const port = (server.address() as { port: number }).port
  // Read at request time, like the env value Next loads during prepare().
  authUrl = `http://localhost:${port}`
  const path = "/login?next=/x&value=%2f&value=one+two"
  const send = (method: string, host = `127.0.0.1:${port}`) =>
    new Promise<{ status: number | undefined; location: string | undefined }>(
      (resolve, reject) => {
        const req = request(
          {
            hostname: "127.0.0.1",
            port,
            path,
            method,
            headers: { host },
            agent: false,
          },
          (res) => {
            res.resume()
            res.on("end", () =>
              resolve({
                status: res.statusCode,
                location: res.headers.location,
              })
            )
          }
        )
        req.on("error", reject)
        req.end()
      }
    )
  try {
    for (const method of ["GET", "HEAD"]) {
      expect(await send(method)).toEqual({
        status: 307,
        location: `${authUrl}${path}`,
      })
    }
    expect(handled).toBe(0)
    expect(await send("POST")).toEqual({ status: 200, location: undefined })
    expect(await send("GET", `localhost:${port}`)).toEqual({
      status: 200,
      location: undefined,
    })
    dev = false
    expect(await send("GET")).toEqual({ status: 200, location: undefined })
    expect(handled).toBe(3)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})

it("leaves API calls alone, like the voice check that calls this server itself", () => {
  const response = { writeHead: () => expect.unreachable(), end: () => null }
  const call = (url: string) =>
    redirectDevAddress(
      { method: "GET", url, headers: { host: "localhost:3101" } },
      response,
      true,
      "http://dev1.localhost:3101"
    )
  expect(call("/api/voice/check?business=1")).toBe(false)
  expect(call("/api")).toBe(false)
})

it("a production request is refused before reading its address", () => {
  const unread = {
    get method() {
      throw new Error("must not read")
    },
  }
  expect(redirectDevAddress(unread, {}, false, "http://localhost:3100")).toBe(
    false
  )
})
