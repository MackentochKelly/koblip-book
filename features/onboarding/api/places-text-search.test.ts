// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { textSearch } = await import("./places-text-search")

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test("textSearch asks only for the row's fields and maps the places", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: "ChIJ9",
              displayName: { text: "Harley M Photography" },
              formattedAddress: "350 Spring St, Brockton, MA",
            },
            { id: "ChIJ8", displayName: { text: "  " } },
            { displayName: { text: "No id" } },
            { id: "ChIJ7", displayName: { text: "Mr. P's" } },
          ],
        })
      )
  )
  vi.stubGlobal("fetch", fetchMock)

  await expect(textSearch({ textQuery: "photography studio" })).resolves.toEqual([
    { placeId: "ChIJ9", name: "Harley M Photography", address: "350 Spring St, Brockton, MA" },
    { placeId: "ChIJ7", name: "Mr. P's", address: null },
  ])
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe("https://places.googleapis.com/v1/places:searchText")
  expect(init.headers).toMatchObject({
    "X-Goog-Api-Key": "test-key",
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
  })
})

test("textSearch throws Google's error message", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
          status: 400,
        })
    )
  )
  await expect(textSearch({ textQuery: "x" })).rejects.toThrow("API key not valid")
})
