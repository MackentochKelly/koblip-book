// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { findPlaceId } = await import("./find-place-id")

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  globalThis.fetch = originalFetch
})

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const result = handler(url, init)
    return result as Response
  }) as typeof fetch
}

test("uses query_place_id straight from a Maps link", async () => {
  const finalUrl =
    "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
  mockFetch((url) => {
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
    )
    return { url: finalUrl }
  })

  await expect(
    findPlaceId(
      "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
    )
  ).resolves.toBe("ChIJdirect123")
  expect(globalThis.fetch).toHaveBeenCalledTimes(1)
})

test("resolves a short link through its place name and coordinates", async () => {
  const finalUrl =
    "https://www.google.com/maps/place/Barbarock+Barbershop+Churchill/@18.4812,-69.9381,17z/data=!4m1"
  let searchBody: Record<string, unknown> | undefined
  mockFetch((url, init) => {
    if (url === "https://maps.app.goo.gl/abc123") {
      return { url: finalUrl }
    }
    searchBody = JSON.parse(init?.body as string) as Record<string, unknown>
    return {
      ok: true,
      json: async () => ({ places: [{ id: "ChIJfromSearch" }] }),
    }
  })

  await expect(findPlaceId("https://maps.app.goo.gl/abc123")).resolves.toBe(
    "ChIJfromSearch"
  )
  expect(searchBody).toMatchObject({
    textQuery: "Barbarock Barbershop Churchill",
    pageSize: 1,
    locationBias: {
      circle: {
        center: { latitude: 18.4812, longitude: -69.9381 },
        radius: 500,
      },
    },
  })
})

test("searches plain text directly", async () => {
  let searchBody: Record<string, unknown> | undefined
  mockFetch((_url, init) => {
    searchBody = JSON.parse(init?.body as string) as Record<string, unknown>
    return {
      ok: true,
      json: async () => ({ places: [{ id: "ChIJplain" }] }),
    }
  })

  await expect(
    findPlaceId("Barbarock Barbershop Churchill Santo Domingo")
  ).resolves.toBe("ChIJplain")
  expect(searchBody).toMatchObject({
    textQuery: "Barbarock Barbershop Churchill Santo Domingo",
    pageSize: 1,
  })
  expect(searchBody).not.toHaveProperty("locationBias")
})

test("throws No business found when nothing matches", async () => {
  mockFetch(() => ({
    ok: true,
    json: async () => ({ places: [] }),
  }))

  await expect(
    findPlaceId("Some place that does not exist anywhere")
  ).rejects.toThrow("No business found")
})
