// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"
import { NextRequest } from "next/server"
vi.mock("server-only", () => ({}))
const { GET } = await import("./route")
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test("a preview fetches only fresh photo metadata and redirects to a thumbnail", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test")
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        photos: [{ name: "places/ChIJ123456789/photos/example" }],
      })
    )
  vi.stubGlobal("fetch", fetcher)
  const response = await GET(
    new NextRequest(
      "https://example.com/api/business-preview-photo?place=ChIJ123456789"
    )
  )
  expect(fetcher).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
      headers: { "X-Goog-Api-Key": "test", "X-Goog-FieldMask": "photos" },
    })
  )
  expect(response.status).toBe(302)
  expect(response.headers.get("Location")).toContain("&size=thumb")
  expect(response.headers.get("Cache-Control")).toBe("no-store")
})

test("invalid place IDs never call Google", async () => {
  const fetcher = vi.fn()
  vi.stubGlobal("fetch", fetcher)
  expect(
    (
      await GET(
        new NextRequest(
          "https://example.com/api/business-preview-photo?place=bad"
        )
      )
    ).status
  ).toBe(404)
  expect(fetcher).not.toHaveBeenCalled()
})

test("upstream failure produces a finished fallback instead of an endless load", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test")
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError"))
  )
  expect(
    (
      await GET(
        new NextRequest(
          "https://example.com/api/business-preview-photo?place=ChIJ123456789"
        )
      )
    ).status
  ).toBe(404)
})
