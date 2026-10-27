// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

const originalFetch = globalThis.fetch
const PHOTO = "places/ChIJ123/photos/AbCdEf"

function request(name: string | null) {
  const url = new URL("http://localhost/api/place-photo")
  if (name !== null) {
    url.searchParams.set("name", name)
  }
  return new NextRequest(url)
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
})

test("rejects names outside places/{placeId}/photos/{photo}", async () => {
  for (const name of [
    null,
    "",
    "places/ChIJ123",
    "places/ChIJ123/photos",
    "places//photos/x",
    "places/a/photos/b/extra",
    "https://example.com/photo.png",
    "../places/x/photos/y",
  ]) {
    const res = await GET(request(name))
    expect(res.status).toBe(400)
  }
})

test("proxies the image with its content type and no-store", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
  const bytes = new TextEncoder().encode("fake-image-bytes")
  let seenUrl = ""
  let seenKey = ""
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url
    seenKey = (init?.headers as Record<string, string>)["X-Goog-Api-Key"]
    return new Response(bytes, {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    })
  }) as typeof fetch

  const res = await GET(request(PHOTO))
  expect(seenUrl).toBe(
    `https://places.googleapis.com/v1/${PHOTO}/media?maxWidthPx=1600`
  )
  expect(seenKey).toBe("test-key")
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe("image/jpeg")
  expect(res.headers.get("Cache-Control")).toBe("no-store")
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
})

test("returns 502 when Google fails", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
  globalThis.fetch = (async () =>
    new Response("nope", { status: 404 })) as typeof fetch

  const res = await GET(request(PHOTO))
  expect(res.status).toBe(502)
})
