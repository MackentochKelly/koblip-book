import { afterEach, expect, test, vi } from "vitest"

import { httpTransport } from "./http-transport"

function stream(chunks: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(iterable: AsyncIterable<unknown>) {
  const out: unknown[] = []
  for await (const event of iterable) out.push(event)
  return out
}

const request = {
  businessId: "b1",
  messages: [{ role: "owner" as const, text: "Hi" }],
}

afterEach(() => vi.unstubAllGlobals())

test("reads events split across chunks", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          stream([
            '{"type":"text","delta":"Hel"}\n{"type":"te',
            'xt","delta":"lo"}\n{"type":"done"}',
          ])
        )
      )
  )
  expect(await collect(httpTransport.chat(request))).toEqual([
    { type: "text", delta: "Hel" },
    { type: "text", delta: "lo" },
    { type: "done" },
  ])
})

test("not logged in means not_allowed, a server failure means unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 401 }))
  )
  expect(await collect(httpTransport.chat(request))).toEqual([
    { type: "error", code: "not_allowed" },
  ])
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("", { status: 500 }))
  )
  expect(await collect(httpTransport.chat(request))).toEqual([
    { type: "error", code: "unavailable" },
  ])
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
  expect(await collect(httpTransport.chat(request))).toEqual([
    { type: "error", code: "unavailable" },
  ])
})
