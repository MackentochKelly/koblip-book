// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { autocomplete } = await import("./places-autocomplete")

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test("autocomplete reads places and suggested searches, in Google's order", async () => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            suggestions: [
              { queryPrediction: { text: { text: "nail salon near Quincy, MA, USA" } } },
              {
                placePrediction: {
                  placeId: "ChIJ1",
                  structuredFormat: {
                    mainText: { text: "Magic Nails" },
                    secondaryText: { text: "Quincy, MA" },
                  },
                },
              },
              { queryPrediction: { text: { text: "  " } } },
              { placePrediction: {} },
            ],
          })
        )
    )
  )

  await expect(autocomplete({ input: "nail salon quincy" })).resolves.toEqual([
    { kind: "query", text: "nail salon near Quincy, MA, USA" },
    { kind: "place", placeId: "ChIJ1", mainText: "Magic Nails", secondaryText: "Quincy, MA" },
  ])
})
